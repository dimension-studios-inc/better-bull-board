import { jobLogsTable, jobRunsTable, jobStatusEnum } from "@better-bull-board/db"
import { db } from "@better-bull-board/db/server"
import {
  and,
  arrayOverlaps,
  asc,
  count,
  desc,
  eq,
  exists,
  gt,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  not,
  or,
  type SQL,
  sql,
} from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { z } from "zod"

import { withListJobsConcurrencyLimit } from "./list-jobs-limit"

export {
  getJobByIdInputSchema,
  getJobByIdOutputSchema,
  listJobLogsInputSchema,
  listJobLogsOutputSchema,
  listJobsInputSchema,
  listJobsOutputSchema,
} from "./job-schemas"

import {
  cancellableJobStatuses,
  countJobsOutputSchema,
  getJobByIdInputSchema,
  getJobByIdOutputSchema,
  jobFiltersSchema,
  listJobLogsInputSchema,
  listJobLogsOutputSchema,
  listJobsInputSchema,
  listJobsOutputSchema,
  replayableJobStatuses,
} from "./job-schemas"

type JobStatus = (typeof jobStatusEnum.enumValues)[number]
type CursorDirection = "next" | "prev"
type SortBy = "createdAt" | "durationMs"
type SortDirection = "asc" | "desc"
type JobCursor = { createdAt: Date; jobId: string; id: string; durationMs?: number | null }

const jobTableColumns = {
  id: jobRunsTable.id,
  jobId: jobRunsTable.jobId,
  queue: jobRunsTable.queue,
  name: jobRunsTable.name,
  status: jobRunsTable.status,
  attempt: jobRunsTable.attempt,
  maxAttempts: jobRunsTable.maxAttempts,
  createdAt: jobRunsTable.createdAt,
  enqueuedAt: jobRunsTable.enqueuedAt,
  startedAt: jobRunsTable.startedAt,
  finishedAt: jobRunsTable.finishedAt,
  durationMs: jobRunsTable.durationMs,
  errorMessage: jobRunsTable.errorMessage,
  tags: jobRunsTable.tags,
}

const parseCreatedBoundary = ({
  fallbackTime,
  isUpperBoundary = false,
  value,
}: {
  fallbackTime: string
  isUpperBoundary?: boolean
  value: string
}) => {
  const valueWithTime = value.includes("T") ? value : `${value}T${fallbackTime}`
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(valueWithTime)
  const date = new Date(hasTimezone ? valueWithTime : `${valueWithTime}Z`)

  if (isUpperBoundary && /T\d{2}:\d{2}$/.test(value)) {
    date.setSeconds(59, 999)
  }

  return date
}

// Shared by the listing, the count and the bulk actions so they always target the same runs
const getJobFilterConditions = ({
  search,
  queue,
  status,
  tags,
  createdFrom,
  createdTo,
}: z.output<typeof jobFiltersSchema>) => {
  const conditions: (SQL | undefined)[] = []

  if (search) {
    const searchConditions = [
      ilike(jobRunsTable.name, `%${search}%`),
      ilike(jobRunsTable.queue, `%${search}%`),
      ilike(jobRunsTable.jobId, `%${search}%`),
      ilike(jobRunsTable.errorMessage, `%${search}%`),
    ]
    if (z.uuid().safeParse(search).success) {
      searchConditions.push(eq(jobRunsTable.id, search))
    }
    conditions.push(or(...searchConditions))
  }

  if (queue && queue !== "all") {
    conditions.push(eq(jobRunsTable.queue, queue))
  }

  if (status && status !== "all" && jobStatusEnum.enumValues.includes(status as JobStatus)) {
    conditions.push(eq(jobRunsTable.status, status as JobStatus))
  }

  if (tags && tags.length > 0) {
    conditions.push(arrayOverlaps(jobRunsTable.tags, tags))
  }

  if (createdFrom) {
    conditions.push(
      gte(
        jobRunsTable.createdAt,
        parseCreatedBoundary({ value: createdFrom, fallbackTime: "00:00" }),
      ),
    )
  }

  if (createdTo) {
    conditions.push(
      lte(
        jobRunsTable.createdAt,
        parseCreatedBoundary({
          value: createdTo,
          fallbackTime: "23:59:59.999",
          isUpperBoundary: true,
        }),
      ),
    )
  }

  return conditions
}

const toCursor = (job: JobCursor) => ({
  createdAt: job.createdAt.getTime(),
  jobId: job.jobId,
  id: job.id,
  durationMs: job.durationMs ?? null,
})

const getOrderDirection = (cursorDirection: CursorDirection, sortDirection: SortDirection) => {
  if (cursorDirection === "next") return sortDirection
  return sortDirection === "desc" ? "asc" : "desc"
}

const getSortOrder = ({
  cursorDirection,
  durationSortExpression,
  sortBy,
  sortDirection,
}: {
  cursorDirection: CursorDirection
  durationSortExpression: ReturnType<typeof sql<number>>
  sortBy: SortBy
  sortDirection: SortDirection
}) => {
  const orderDirection = getOrderDirection(cursorDirection, sortDirection)

  if (sortBy === "durationMs") {
    return orderDirection === "desc"
      ? [
          desc(durationSortExpression),
          desc(jobRunsTable.createdAt),
          desc(jobRunsTable.jobId),
          desc(jobRunsTable.id),
        ]
      : [
          asc(durationSortExpression),
          asc(jobRunsTable.createdAt),
          asc(jobRunsTable.jobId),
          asc(jobRunsTable.id),
        ]
  }

  return orderDirection === "desc"
    ? [desc(jobRunsTable.createdAt), desc(jobRunsTable.jobId), desc(jobRunsTable.id)]
    : [asc(jobRunsTable.createdAt), asc(jobRunsTable.jobId), asc(jobRunsTable.id)]
}

const getCreatedAtCursorComparison = ({
  createdAt,
  id,
  jobId,
  useLessThan,
}: {
  createdAt: Date
  id: string
  jobId: string
  useLessThan: boolean
}) =>
  useLessThan
    ? or(
        lt(jobRunsTable.createdAt, createdAt),
        and(eq(jobRunsTable.createdAt, createdAt), lt(jobRunsTable.jobId, jobId)),
        and(
          eq(jobRunsTable.createdAt, createdAt),
          eq(jobRunsTable.jobId, jobId),
          lt(jobRunsTable.id, id),
        ),
      )
    : or(
        gt(jobRunsTable.createdAt, createdAt),
        and(eq(jobRunsTable.createdAt, createdAt), gt(jobRunsTable.jobId, jobId)),
        and(
          eq(jobRunsTable.createdAt, createdAt),
          eq(jobRunsTable.jobId, jobId),
          gt(jobRunsTable.id, id),
        ),
      )

const getCursorComparison = ({
  cursor,
  cursorDirection,
  durationSortExpression,
  sortBy,
  sortDirection,
}: {
  cursor: { createdAt: number; jobId: string; id: string; durationMs?: number | null }
  cursorDirection: CursorDirection
  durationSortExpression: ReturnType<typeof sql<number>>
  sortBy: SortBy
  sortDirection: SortDirection
}) => {
  const createdAt = new Date(cursor.createdAt)
  const useLessThan =
    cursorDirection === "next" ? sortDirection === "desc" : sortDirection === "asc"
  const createdAtComparison = getCreatedAtCursorComparison({
    createdAt,
    id: cursor.id,
    jobId: cursor.jobId,
    useLessThan,
  })

  if (sortBy !== "durationMs") {
    return createdAtComparison
  }

  const durationMs = cursor.durationMs ?? 0
  return or(
    useLessThan ? lt(durationSortExpression, durationMs) : gt(durationSortExpression, durationMs),
    and(eq(durationSortExpression, durationMs), createdAtComparison),
  )
}

export const listJobs = async (input: z.input<typeof listJobsInputSchema> = {}) =>
  withListJobsConcurrencyLimit(async () => {
    const parsed = listJobsInputSchema.parse(input)
    const { cursor, cursorDirection = "next" } = parsed
    const limit = parsed.limit ?? 20
    const sortBy = parsed.sortBy ?? "createdAt"
    const sortDirection = parsed.sortDirection ?? "desc"
    const durationSortExpression = sql<number>`COALESCE(${jobRunsTable.durationMs}, 0)`

    const conditions = getJobFilterConditions(parsed)

    if (cursor) {
      conditions.push(
        getCursorComparison({
          cursor,
          cursorDirection,
          durationSortExpression,
          sortBy,
          sortDirection,
        }),
      )
    }

    const rows = await db
      .select(jobTableColumns)
      .from(jobRunsTable)
      .where(and(...conditions))
      .orderBy(
        ...getSortOrder({
          cursorDirection,
          durationSortExpression,
          sortBy,
          sortDirection,
        }),
      )
      .limit(limit + 1)

    const hasExtra = rows.length > limit

    if (hasExtra) {
      rows.pop()
    }

    const jobs = cursorDirection === "prev" ? rows.toReversed() : rows
    const firstJob = jobs[0]
    const lastJob = jobs.at(-1)
    const hasNewerPage = cursorDirection === "next" ? Boolean(cursor) : hasExtra
    const hasOlderPage = cursorDirection === "prev" ? Boolean(cursor) : hasExtra

    return listJobsOutputSchema.parse({
      jobs,
      nextCursor: hasOlderPage && lastJob ? toCursor(lastJob) : null,
      prevCursor: hasNewerPage && firstJob ? toCursor(firstJob) : null,
    })
  })

export const countJobs = async (input: z.input<typeof jobFiltersSchema> = {}) => {
  const filters = jobFiltersSchema.parse(input)

  const [row] = await db
    .select({
      total: count(),
      replayable: count(
        sql`CASE WHEN ${inArray(jobRunsTable.status, [...replayableJobStatuses])} THEN 1 END`,
      ),
      cancellable: count(
        sql`CASE WHEN ${inArray(jobRunsTable.status, [...cancellableJobStatuses])} THEN 1 END`,
      ),
    })
    .from(jobRunsTable)
    .where(and(...getJobFilterConditions(filters)))

  return countJobsOutputSchema.parse({
    total: row?.total ?? 0,
    replayable: row?.replayable ?? 0,
    cancellable: row?.cancellable ?? 0,
  })
}

const newerJobRunsTable = alias(jobRunsTable, "newer_job_runs")

// Newest first, so runs created while a bulk action walks the pages (like replays) are never revisited
export const listJobRunKeys = async ({
  filters,
  statuses,
  cursor,
  limit,
}: {
  filters: z.input<typeof jobFiltersSchema>
  statuses: readonly JobStatus[]
  cursor: { createdAt: Date; jobId: string; id: string } | null
  limit: number
}) => {
  const conditions = [
    ...getJobFilterConditions(jobFiltersSchema.parse(filters)),
    inArray(jobRunsTable.status, [...statuses]),
  ]

  if (cursor) {
    conditions.push(getCreatedAtCursorComparison({ ...cursor, useLessThan: true }))
  }

  return db
    .select({
      id: jobRunsTable.id,
      jobId: jobRunsTable.jobId,
      queue: jobRunsTable.queue,
      createdAt: jobRunsTable.createdAt,
      // A retried job gets a new run: acting on an older one would hit a job that already moved on
      isLatestRun: sql<boolean>`${not(
        exists(
          db
            .select({ id: newerJobRunsTable.id })
            .from(newerJobRunsTable)
            .where(
              and(
                eq(newerJobRunsTable.queue, jobRunsTable.queue),
                eq(newerJobRunsTable.jobId, jobRunsTable.jobId),
                gt(newerJobRunsTable.enqueuedAt, jobRunsTable.enqueuedAt),
              ),
            ),
        ),
      )}`,
    })
    .from(jobRunsTable)
    .where(and(...conditions))
    .orderBy(desc(jobRunsTable.createdAt), desc(jobRunsTable.jobId), desc(jobRunsTable.id))
    .limit(limit)
}

export const getJobById = async (input: z.input<typeof getJobByIdInputSchema>) => {
  const { id } = getJobByIdInputSchema.parse(input)
  const [jobRun] = await db.select().from(jobRunsTable).where(eq(jobRunsTable.id, id))

  if (!jobRun) {
    throw new Error("Job run not found")
  }

  return getJobByIdOutputSchema.parse({
    job: {
      ...jobRun,
      createdAt: jobRun.createdAt.getTime(),
      enqueuedAt: jobRun.enqueuedAt?.getTime() ?? null,
      startedAt: jobRun.startedAt?.getTime() ?? null,
      finishedAt: jobRun.finishedAt?.getTime() ?? null,
    },
  })
}

export const listJobLogs = async (input: z.input<typeof listJobLogsInputSchema>) => {
  const {
    id,
    level,
    messageContains,
    limit = 100,
    offset = 0,
  } = listJobLogsInputSchema.parse(input)
  const conditions = [eq(jobLogsTable.jobRunId, id)]

  if (level) {
    conditions.push(eq(jobLogsTable.level, level))
  }

  if (messageContains) {
    conditions.push(ilike(jobLogsTable.message, `%${messageContains}%`))
  }

  const whereClause = and(...conditions)

  const [logs, [countRow]] = await Promise.all([
    db
      .select()
      .from(jobLogsTable)
      .where(whereClause)
      .orderBy(asc(jobLogsTable.ts), asc(jobLogsTable.logSeq))
      .limit(limit)
      .offset(offset),
    db
      // count(*) is a bigint, which node-postgres returns as a string.
      .select({ count: sql<string>`count(*)` })
      .from(jobLogsTable)
      .where(whereClause),
  ])

  return listJobLogsOutputSchema.parse({
    logs: logs.map((log) => ({
      ...log,
      ts: log.ts.getTime(),
    })),
    total: Number(countRow?.count ?? 0),
  })
}
