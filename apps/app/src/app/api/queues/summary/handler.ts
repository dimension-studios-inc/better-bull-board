import { jobRunsTable } from "@better-bull-board/db"
import { db } from "@better-bull-board/db/server"
import { utcTimestamp } from "@better-bull-board/db/utils/timestamp"
import { sql } from "drizzle-orm"
import type { z } from "zod"

import {
  type BucketRow,
  type DashboardWindow,
  floorTo,
  getBucketRows,
  getDashboardWindow,
  toNumber,
} from "~/app/api/dashboard/summary/handler"
import type {
  queueSummaryGraphOutput,
  queueSummaryStatsOutput,
} from "~/app/api/queues/summary/schemas"

type QueueSummaryStats = z.output<typeof queueSummaryStatsOutput>
type QueueSummaryGraphPoint = z.output<typeof queueSummaryGraphOutput>

type DurationRow = {
  // Null on the row covering the whole period
  bucket_epoch: string | number | null
  p50_ms: string | number | null
  p95_ms: string | number | null
  p99_ms: string | number | null
  sample_size: string | number
}

const toNullableNumber = (value: string | number | null) => (value == null ? null : Number(value))

// Percentiles sort every sample: on a busy queue over a long period, only the latest runs are read
const MAX_DURATION_SAMPLES = 100_000

/**
 * Duration percentiles of the completed runs, per graph bucket and for the whole period in one scan.
 * The rollups only keep sums, so this reads job_runs (index on queue, status, created_at).
 */
const getDurationRows = async (
  queue: string,
  { dateFrom, dateTo, bucketSeconds }: DashboardWindow,
) => {
  const bucket = sql.raw(String(bucketSeconds))
  const result = await db.execute(sql`
    SELECT
      "bucket_epoch",
      percentile_cont(0.5) WITHIN GROUP (ORDER BY "duration_ms") AS "p50_ms",
      percentile_cont(0.95) WITHIN GROUP (ORDER BY "duration_ms") AS "p95_ms",
      percentile_cont(0.99) WITHIN GROUP (ORDER BY "duration_ms") AS "p99_ms",
      COUNT(*) AS "sample_size"
    FROM (
      SELECT
        (FLOOR(EXTRACT(EPOCH FROM "created_at") / ${bucket}) * ${bucket})::bigint AS "bucket_epoch",
        "duration_ms"
      FROM ${jobRunsTable}
      WHERE "queue" = ${queue}
        AND "status" = 'completed'::"job_status"
        AND "duration_ms" IS NOT NULL
        AND "created_at" >= ${utcTimestamp(dateFrom)}
        AND "created_at" < ${utcTimestamp(dateTo)}
      ORDER BY "created_at" DESC
      LIMIT ${sql.raw(String(MAX_DURATION_SAMPLES))}
    ) AS "completed_runs"
    GROUP BY GROUPING SETS (("bucket_epoch"), ())
  `)
  return result.rows as DurationRow[]
}

const getStats = (
  bucketRows: BucketRow[],
  periodDurations: DurationRow | undefined,
): QueueSummaryStats => {
  let totalRuns = 0
  let successes = 0
  let failures = 0
  for (const row of bucketRows) {
    totalRuns += toNumber(row.total_runs)
    successes += toNumber(row.completed_runs)
    failures += toNumber(row.failed_runs)
  }

  return {
    totalRuns,
    successes,
    failures,
    errorRate: totalRuns > 0 ? (failures / totalRuns) * 100 : 0,
    p50DurationMs: toNullableNumber(periodDurations?.p50_ms ?? null),
    p95DurationMs: toNullableNumber(periodDurations?.p95_ms ?? null),
    p99DurationMs: toNullableNumber(periodDurations?.p99_ms ?? null),
    // Older completed runs of the period were left out of the percentiles
    durationSampleLimit:
      toNumber(periodDurations?.sample_size) >= MAX_DURATION_SAMPLES ? MAX_DURATION_SAMPLES : null,
  }
}

const getGraph = (
  bucketRows: BucketRow[],
  bucketDurations: DurationRow[],
  { dateFrom, dateTo, bucketSeconds }: DashboardWindow,
): QueueSummaryGraphPoint[] => {
  const bucketMs = bucketSeconds * 1000
  // A bucket can have a row from the rollups and one from job_runs
  const counts = new Map<number, { total: number; completed: number; failed: number }>()
  for (const row of bucketRows) {
    const bucketStartMs = toNumber(row.bucket_epoch) * 1000
    const count = counts.get(bucketStartMs) ?? { total: 0, completed: 0, failed: 0 }
    count.total += toNumber(row.total_runs)
    count.completed += toNumber(row.completed_runs)
    count.failed += toNumber(row.failed_runs)
    counts.set(bucketStartMs, count)
  }
  const durations = new Map(bucketDurations.map((row) => [toNumber(row.bucket_epoch) * 1000, row]))

  const graph: QueueSummaryGraphPoint[] = []
  for (let d = floorTo(dateFrom, bucketMs).getTime(); d <= dateTo.getTime(); d += bucketMs) {
    const count = counts.get(d)
    const duration = durations.get(d)
    graph.push({
      timestamp: new Date(d).toISOString(),
      completed: count?.completed ?? 0,
      failed: count?.failed ?? 0,
      errorRate: count && count.total > 0 ? (count.failed / count.total) * 100 : null,
      p50DurationMs: toNullableNumber(duration?.p50_ms ?? null),
      p95DurationMs: toNullableNumber(duration?.p95_ms ?? null),
    })
  }

  return graph
}

export const getQueueSummary = async ({
  queueName,
  minutes,
}: {
  queueName: string
  minutes: number
}) => {
  const dashboardWindow = await getDashboardWindow(minutes)

  const [bucketRows, durationRows] = await Promise.all([
    getBucketRows(dashboardWindow, queueName),
    getDurationRows(queueName, dashboardWindow),
  ])

  return {
    stats: getStats(
      bucketRows,
      durationRows.find((row) => row.bucket_epoch == null),
    ),
    graph: getGraph(
      bucketRows,
      durationRows.filter((row) => row.bucket_epoch != null),
      dashboardWindow,
    ),
  }
}
