import { jobRunsTable, jobSchedulersTable, queuesTable } from "@better-bull-board/db"
import { db } from "@better-bull-board/db/server"
import { CronExpressionParser } from "cron-parser"
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm"
import type { z } from "zod"
import { listSchedulersInputSchema, listSchedulersOutputSchema } from "./scheduler-schemas"

const STARTED_STATUSES = ["active", "completed", "failed"] as const
const PENDING_STATUSES = ["waiting", "delayed", "prioritized", "waiting-children"] as const

const MIN_MISSED_GRACE_MS = 60_000
const MISSED_GRACE_INTERVAL_RATIO = 0.1
// Delayed jobs and runs of workers without the client are only seen by the ingest reconciler, once a minute
const INGEST_LAG_MS = 60_000

// Runs created by a scheduler carry its key as BullMQ repeatJobKey; both lookups walk ix_job_runs_repeat_key_created_at
// backwards and stop at the first match
const lastStartedRun = db
  .select({
    id: jobRunsTable.id,
    jobId: jobRunsTable.jobId,
    status: jobRunsTable.status,
    createdAt: jobRunsTable.createdAt,
    startedAt: jobRunsTable.startedAt,
    finishedAt: jobRunsTable.finishedAt,
    enqueuedAt: jobRunsTable.enqueuedAt,
    delayMs: jobRunsTable.delayMs,
  })
  .from(jobRunsTable)
  .where(
    and(
      eq(jobRunsTable.repeatJobKey, jobSchedulersTable.key),
      eq(jobRunsTable.queue, queuesTable.name),
      inArray(jobRunsTable.status, [...STARTED_STATUSES]),
    ),
  )
  .orderBy(desc(jobRunsTable.createdAt))
  .limit(1)
  .as("last_started_run")

// BullMQ creates the job of the next iteration ahead of time, delayed until it is due
const pendingRun = db
  .select({
    createdAt: jobRunsTable.createdAt,
    enqueuedAt: jobRunsTable.enqueuedAt,
    delayMs: jobRunsTable.delayMs,
  })
  .from(jobRunsTable)
  .where(
    and(
      eq(jobRunsTable.repeatJobKey, jobSchedulersTable.key),
      eq(jobRunsTable.queue, queuesTable.name),
      inArray(jobRunsTable.status, [...PENDING_STATUSES]),
    ),
  )
  .orderBy(desc(jobRunsTable.createdAt))
  .limit(1)
  .as("pending_run")

type Schedule = { pattern: string | null; every: number | null; tz: string | null }

const getDueAt = (run: { createdAt: Date; enqueuedAt: Date | null; delayMs: number }) =>
  (run.enqueuedAt ?? run.createdAt).getTime() + run.delayMs

const getNextCronOccurrence = (pattern: string, tz: string | null, after: number) => {
  try {
    return CronExpressionParser.parse(pattern, { currentDate: after, tz: tz ?? undefined })
      .next()
      .getTime()
  } catch {
    return null
  }
}

/** Same arithmetic as BullMQ: an `every` scheduler runs `every` ms after its previous iteration */
const getNextOccurrence = ({ pattern, every, tz }: Schedule, after: number, afterIsIteration: boolean) => {
  if (every) return afterIsIteration ? after + every : Math.floor(after / every) * every + every
  if (pattern) return getNextCronOccurrence(pattern, tz, after)
  return null
}

const getIntervalMs = ({ pattern, every, tz }: Schedule, at: number) => {
  if (every) return every
  if (!pattern) return null
  const following = getNextCronOccurrence(pattern, tz, at)
  return following === null ? null : following - at
}

export const listSchedulers = async (input: z.input<typeof listSchedulersInputSchema> = {}) => {
  const { queue, search, sortDirection = "asc" } = listSchedulersInputSchema.parse(input)

  const rows = await db
    .select({
      id: jobSchedulersTable.id,
      key: jobSchedulersTable.key,
      name: jobSchedulersTable.name,
      pattern: jobSchedulersTable.pattern,
      every: jobSchedulersTable.every,
      tz: jobSchedulersTable.tz,
      endDate: jobSchedulersTable.endDate,
      queue: queuesTable.name,
      queueIsPaused: queuesTable.isPaused,
      lastRunId: lastStartedRun.id,
      lastRunJobId: lastStartedRun.jobId,
      lastRunStatus: lastStartedRun.status,
      lastRunCreatedAt: lastStartedRun.createdAt,
      lastRunStartedAt: lastStartedRun.startedAt,
      lastRunFinishedAt: lastStartedRun.finishedAt,
      lastRunEnqueuedAt: lastStartedRun.enqueuedAt,
      lastRunDelayMs: lastStartedRun.delayMs,
      pendingRunCreatedAt: pendingRun.createdAt,
      pendingRunEnqueuedAt: pendingRun.enqueuedAt,
      pendingRunDelayMs: pendingRun.delayMs,
    })
    .from(jobSchedulersTable)
    .innerJoin(queuesTable, eq(queuesTable.id, jobSchedulersTable.queueId))
    .leftJoinLateral(lastStartedRun, sql`true`)
    .leftJoinLateral(pendingRun, sql`true`)
    .where(
      and(
        queue && queue !== "all" ? eq(queuesTable.name, queue) : undefined,
        search
          ? or(
              ilike(jobSchedulersTable.key, `%${search}%`),
              ilike(jobSchedulersTable.name, `%${search}%`),
              ilike(queuesTable.name, `%${search}%`),
            )
          : undefined,
      ),
    )

  const now = Date.now()

  const schedulers = rows.map((row) => {
    const lastRunDueAt =
      row.lastRunCreatedAt && row.lastRunDelayMs !== null
        ? getDueAt({ createdAt: row.lastRunCreatedAt, enqueuedAt: row.lastRunEnqueuedAt, delayMs: row.lastRunDelayMs })
        : null
    // A pending row older than the last started run is a leftover the ingest has not retired yet
    const pendingRunDueAt =
      row.pendingRunCreatedAt &&
      row.pendingRunDelayMs !== null &&
      (!row.lastRunCreatedAt || row.pendingRunCreatedAt >= row.lastRunCreatedAt)
        ? getDueAt({
            createdAt: row.pendingRunCreatedAt,
            enqueuedAt: row.pendingRunEnqueuedAt,
            delayMs: row.pendingRunDelayMs,
          })
        : null

    // The pending job is the next run; until the ingest sees it, derive it from the last run like BullMQ does
    let nextRunAt =
      pendingRunDueAt ??
      (lastRunDueAt !== null ? getNextOccurrence(row, lastRunDueAt, true) : getNextOccurrence(row, now, false))
    if (pendingRunDueAt === null && nextRunAt !== null && row.endDate && nextRunAt > row.endDate.getTime()) {
      nextRunAt = null
    }

    const intervalMs = nextRunAt === null ? null : getIntervalMs(row, nextRunAt)
    const missedGraceMs = Math.max(MIN_MISSED_GRACE_MS, (intervalMs ?? 0) * MISSED_GRACE_INTERVAL_RATIO) + INGEST_LAG_MS

    return {
      id: row.id,
      key: row.key,
      name: row.name,
      queue: row.queue,
      queueIsPaused: row.queueIsPaused,
      pattern: row.pattern,
      every: row.every,
      tz: row.tz,
      endDate: row.endDate,
      nextRunAt: nextRunAt === null ? null : new Date(nextRunAt),
      // A paused queue holds its jobs on purpose
      isMissed: !row.queueIsPaused && nextRunAt !== null && now - nextRunAt > missedGraceMs,
      lastRun:
        row.lastRunId && row.lastRunJobId && row.lastRunStatus && row.lastRunCreatedAt
          ? {
              id: row.lastRunId,
              jobId: row.lastRunJobId,
              status: row.lastRunStatus,
              at: row.lastRunFinishedAt ?? row.lastRunStartedAt ?? row.lastRunCreatedAt,
            }
          : null,
    }
  })

  const direction = sortDirection === "asc" ? 1 : -1
  schedulers.sort((a, b) => {
    // Schedulers without a next run go last in both directions
    if (a.nextRunAt === null || b.nextRunAt === null) {
      if (a.nextRunAt !== b.nextRunAt) return a.nextRunAt === null ? 1 : -1
    } else if (a.nextRunAt.getTime() !== b.nextRunAt.getTime()) {
      return (a.nextRunAt.getTime() - b.nextRunAt.getTime()) * direction
    }
    return a.queue.localeCompare(b.queue) || a.key.localeCompare(b.key)
  })

  return listSchedulersOutputSchema.parse({ schedulers })
}
