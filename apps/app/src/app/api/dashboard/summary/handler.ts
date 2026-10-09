import { dashboardQueueHourlyStatsTable, jobRunsTable } from "@better-bull-board/db"
import { db } from "@better-bull-board/db/server"
import { utcTimestamp } from "@better-bull-board/db/utils/timestamp"
import { type SQL, sql } from "drizzle-orm"
import type { z } from "zod"

import type { getDashboardSummaryOutput } from "~/app/api/dashboard/summary/schemas"

export type DashboardSummary = z.output<typeof getDashboardSummaryOutput>

type StatsRow = {
  running_tasks: string | number | null
  waiting_in_queue: string | number | null
}

export type BucketRow = {
  bucket_epoch: string | number
  queue: string
  total_runs: string | number
  completed_runs: string | number
  failed_runs: string | number
  duration_total_ms: string | number | null
  duration_count: string | number | null
  duration_min_ms: string | number | null
  duration_max_ms: string | number | null
}

type TimeRange = { from: Date; to: Date }

export type DashboardWindow = {
  dateFrom: Date
  dateTo: Date
  bucketSeconds: number
  // Complete hours read from the hourly rollups, [from, to)
  rollupRange: TimeRange | null
  // Ranges not covered by the rollups (partial edge hours, short periods), read from job_runs, [from, to)
  rawRanges: TimeRange[]
}

const HOUR_MS = 60 * 60 * 1000
// Below this period the dashboard reads job_runs only, so the graph can use sub-hour buckets
const RAW_ONLY_MAX_MINUTES = 3 * 60
// Bound the raw tail scanned when the ingest rollups lag behind (ingest down, cron not run yet)
const MAX_ROLLUP_LAG_MS = 3 * HOUR_MS

export const toNumber = (value: string | number | null | undefined) => Number(value ?? 0)

const toSeconds = (milliseconds: string | number | null | undefined) =>
  toNumber(milliseconds) / 1000

export const floorTo = (date: Date, ms: number) => new Date(Math.floor(date.getTime() / ms) * ms)

const ceilTo = (date: Date, ms: number) => new Date(Math.ceil(date.getTime() / ms) * ms)

const getBucketSeconds = (minutes: number) => {
  if (minutes <= 5) return 10
  if (minutes <= 15) return 30
  if (minutes <= 30) return 60
  if (minutes <= 60) return 2 * 60
  if (minutes < RAW_ONLY_MAX_MINUTES) return 5 * 60
  if (minutes <= 7 * 24 * 60) return 60 * 60
  return 24 * 60 * 60
}

const getLastRollupEnd = async () => {
  const result = await db.execute(sql`
      SELECT EXTRACT(EPOCH FROM MAX("bucket_start"))::bigint AS "last_bucket_epoch"
      FROM ${dashboardQueueHourlyStatsTable}
    `)
  const lastBucketEpoch = (result.rows as { last_bucket_epoch: string | number | null }[])[0]
    ?.last_bucket_epoch

  return lastBucketEpoch == null ? null : new Date(toNumber(lastBucketEpoch) * 1000 + HOUR_MS)
}

export const getDashboardWindow = async (minutes: number): Promise<DashboardWindow> => {
  const dateTo = new Date()
  const dateFrom = new Date(dateTo.getTime() - minutes * 60 * 1000)
  const bucketSeconds = getBucketSeconds(minutes)

  if (minutes < RAW_ONLY_MAX_MINUTES) {
    return {
      dateFrom,
      dateTo,
      bucketSeconds,
      rollupRange: null,
      rawRanges: [{ from: dateFrom, to: dateTo }],
    }
  }

  // Rollups only exist for completed hours, and the last one may not be computed yet
  const currentHour = floorTo(dateTo, HOUR_MS)
  const lastRollupEnd = (await getLastRollupEnd()) ?? currentHour
  const rollupTo = new Date(
    Math.max(
      Math.min(currentHour.getTime(), lastRollupEnd.getTime()),
      currentHour.getTime() - MAX_ROLLUP_LAG_MS,
    ),
  )
  const rollupFrom = ceilTo(dateFrom, HOUR_MS)

  if (rollupFrom >= rollupTo) {
    return {
      dateFrom,
      dateTo,
      bucketSeconds,
      rollupRange: null,
      rawRanges: [{ from: dateFrom, to: dateTo }],
    }
  }

  return {
    dateFrom,
    dateTo,
    bucketSeconds,
    rollupRange: { from: rollupFrom, to: rollupTo },
    rawRanges: [
      { from: dateFrom, to: rollupFrom },
      { from: rollupTo, to: dateTo },
    ].filter((range) => range.from < range.to),
  }
}

const getStats = async () => {
  const result = await db.execute(sql`
      SELECT
        (
          SELECT COUNT(*)
          FROM ${jobRunsTable}
          WHERE ${jobRunsTable.status} = 'active'
        )::bigint AS "running_tasks",
        (
          SELECT COUNT(*)
          FROM ${jobRunsTable}
          WHERE ${jobRunsTable.status} = 'waiting'
        )::bigint AS "waiting_in_queue"
    `)
  const stats = (result.rows as StatsRow[])[0]

  return {
    runningTasks: toNumber(stats?.running_tasks),
    waitingInQueue: toNumber(stats?.waiting_in_queue),
  }
}

/**
 * Per queue and per graph bucket counters for the window, merging the hourly rollups (complete hours)
 * with the same aggregation computed on job_runs for the rest of the window.
 */
export const getBucketRows = async (
  { bucketSeconds, rollupRange, rawRanges }: DashboardWindow,
  queue?: string,
) => {
  const bucket = sql.raw(String(bucketSeconds))
  const queueFilter = queue ? sql` AND "queue" = ${queue}` : sql``
  const parts: SQL[] = []

  if (rollupRange) {
    parts.push(sql`
      SELECT
        (FLOOR(EXTRACT(EPOCH FROM "bucket_start") / ${bucket}) * ${bucket})::bigint AS "bucket_epoch",
        "queue",
        SUM("total_runs")::bigint AS "total_runs",
        SUM("completed_runs")::bigint AS "completed_runs",
        SUM("failed_runs")::bigint AS "failed_runs",
        SUM("duration_total_ms")::bigint AS "duration_total_ms",
        SUM("duration_count")::bigint AS "duration_count",
        MIN("duration_min_ms") AS "duration_min_ms",
        MAX("duration_max_ms") AS "duration_max_ms"
      FROM ${dashboardQueueHourlyStatsTable}
      WHERE "bucket_start" >= ${utcTimestamp(rollupRange.from)}
        AND "bucket_start" < ${utcTimestamp(rollupRange.to)}${queueFilter}
      GROUP BY 1, 2
    `)
  }

  if (rawRanges.length > 0) {
    const rawRangesFilter = sql.join(
      rawRanges.map(
        (range) =>
          sql`("created_at" >= ${utcTimestamp(range.from)} AND "created_at" < ${utcTimestamp(range.to)})`,
      ),
      sql` OR `,
    )

    // Same aggregation as the ingest dashboard rollups
    parts.push(sql`
      SELECT
        (FLOOR(EXTRACT(EPOCH FROM "created_at") / ${bucket}) * ${bucket})::bigint AS "bucket_epoch",
        "queue",
        COUNT(*)::bigint AS "total_runs",
        COUNT(*) FILTER (WHERE "status" = 'completed'::"job_status")::bigint AS "completed_runs",
        COUNT(*) FILTER (WHERE "status" = 'failed'::"job_status")::bigint AS "failed_runs",
        COALESCE(
          SUM("duration_ms") FILTER (WHERE "status" = 'completed'::"job_status" AND "duration_ms" IS NOT NULL),
          0
        )::bigint AS "duration_total_ms",
        COUNT("duration_ms") FILTER (
          WHERE "status" = 'completed'::"job_status" AND "duration_ms" IS NOT NULL
        )::bigint AS "duration_count",
        MIN("duration_ms") FILTER (
          WHERE "status" = 'completed'::"job_status" AND "duration_ms" IS NOT NULL
        ) AS "duration_min_ms",
        MAX("duration_ms") FILTER (
          WHERE "status" = 'completed'::"job_status" AND "duration_ms" IS NOT NULL
        ) AS "duration_max_ms"
      FROM ${jobRunsTable}
      WHERE (${rawRangesFilter})${queueFilter}
      GROUP BY 1, 2
    `)
  }

  const result = await db.execute(sql.join(parts, sql` UNION ALL `))
  return result.rows as BucketRow[]
}

const getQueuePerformance = (rows: BucketRow[]): DashboardSummary["queuePerformance"] => {
  const queues = new Map<
    string,
    {
      totalRuns: number
      successes: number
      failures: number
      durationTotalMs: number
      durationCount: number
      minDurationMs: number | null
      maxDurationMs: number | null
    }
  >()

  for (const row of rows) {
    const queue = queues.get(row.queue) ?? {
      totalRuns: 0,
      successes: 0,
      failures: 0,
      durationTotalMs: 0,
      durationCount: 0,
      minDurationMs: null,
      maxDurationMs: null,
    }
    queue.totalRuns += toNumber(row.total_runs)
    queue.successes += toNumber(row.completed_runs)
    queue.failures += toNumber(row.failed_runs)
    queue.durationTotalMs += toNumber(row.duration_total_ms)
    queue.durationCount += toNumber(row.duration_count)
    if (row.duration_min_ms != null) {
      const minDurationMs = toNumber(row.duration_min_ms)
      queue.minDurationMs =
        queue.minDurationMs == null ? minDurationMs : Math.min(queue.minDurationMs, minDurationMs)
    }
    if (row.duration_max_ms != null) {
      const maxDurationMs = toNumber(row.duration_max_ms)
      queue.maxDurationMs =
        queue.maxDurationMs == null ? maxDurationMs : Math.max(queue.maxDurationMs, maxDurationMs)
    }
    queues.set(row.queue, queue)
  }

  return [...queues.entries()]
    .map(([queue, stats]) => ({
      queue,
      totalRuns: stats.totalRuns,
      successes: stats.successes,
      failures: stats.failures,
      errorRate: stats.totalRuns > 0 ? (stats.failures / stats.totalRuns) * 100 : 0,
      avgDuration: stats.durationCount > 0 ? stats.durationTotalMs / stats.durationCount / 1000 : 0,
      minDuration: toSeconds(stats.minDurationMs),
      maxDuration: toSeconds(stats.maxDurationMs),
    }))
    .toSorted((a, b) => b.totalRuns - a.totalRuns)
}

const getRunGraph = (rows: BucketRow[], { dateFrom, dateTo, bucketSeconds }: DashboardWindow) => {
  const bucketMs = bucketSeconds * 1000
  const runCounts = new Map<number, number>()

  for (const row of rows) {
    const bucketStartMs = toNumber(row.bucket_epoch) * 1000
    runCounts.set(bucketStartMs, (runCounts.get(bucketStartMs) ?? 0) + toNumber(row.total_runs))
  }

  const runGraph = []
  for (let d = floorTo(dateFrom, bucketMs).getTime(); d <= dateTo.getTime(); d += bucketMs) {
    runGraph.push({ timestamp: new Date(d).toISOString(), runCount: runCounts.get(d) ?? 0 })
  }

  return runGraph
}

const getTopQueuesCount = (queuePerformance: DashboardSummary["queuePerformance"]) =>
  queuePerformance.slice(0, 20).map((row) => ({
    queue: row.queue,
    runCount: row.totalRuns,
  }))

const getTopQueuesDuration = (queuePerformance: DashboardSummary["queuePerformance"]) => {
  const rows = queuePerformance
    .map((row) => ({
      queue: row.queue,
      avgDuration: row.avgDuration,
    }))
    .filter((row) => row.avgDuration > 0)
    .toSorted((a, b) => b.avgDuration - a.avgDuration)
  return rows.slice(0, 20)
}

export const getDashboardSummary = async ({
  minutes,
}: {
  minutes: number
}): Promise<DashboardSummary> => {
  const dashboardWindow = await getDashboardWindow(minutes)

  const [stats, bucketRows] = await Promise.all([getStats(), getBucketRows(dashboardWindow)])

  const queuePerformance = getQueuePerformance(bucketRows)

  return {
    enhancedStats: {
      ...stats,
      successes: queuePerformance.reduce((total, queue) => total + queue.successes, 0),
      failures: queuePerformance.reduce((total, queue) => total + queue.failures, 0),
    },
    queuePerformance,
    topQueuesCount: getTopQueuesCount(queuePerformance),
    topQueuesDuration: getTopQueuesDuration(queuePerformance),
    runGraph: getRunGraph(bucketRows, dashboardWindow),
  }
}
