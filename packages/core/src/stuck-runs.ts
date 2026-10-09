import { jobRunsTable } from "@better-bull-board/db"
import { db } from "@better-bull-board/db/server"
import { inArray, sql } from "drizzle-orm"
import type { z } from "zod"

import { listStuckRunsInputSchema, listStuckRunsOutputSchema } from "./stuck-run-schemas"

/*
 * An active run is stuck when it has been running for longer than
 * max(STUCK_FLOOR_MS, STUCK_P95_MULTIPLIER × p95 duration of the completed runs of its queue over the last
 * STUCK_BASELINE_DAYS days). A queue with fewer than STUCK_MIN_SAMPLES completed runs has no reliable p95, so it
 * gets the larger STUCK_LOW_SAMPLE_FLOOR_MS floor instead.
 */
const STUCK_P95_MULTIPLIER = 3
const STUCK_FLOOR_MS = 5 * 60 * 1000
const STUCK_LOW_SAMPLE_FLOOR_MS = 30 * 60 * 1000
const STUCK_MIN_SAMPLES = 20
const STUCK_BASELINE_DAYS = 7
/** Busy queues complete millions of runs a week: the latest ones are plenty for a p95 and keep the scan bounded */
const STUCK_MAX_SAMPLES = 10_000

type StuckRunRow = {
  id: string
  job_id: string
  queue: string
  name: string | null
  worker_id: string | null
  started_at_ms: number | string
  running_for_ms: number | string
  threshold_ms: number | string
  p95_ms: number | string | null
  sample_size: number | string
  total: number | string
}

export const listStuckRuns = async (input: z.input<typeof listStuckRunsInputSchema> = {}) => {
  const { ids, limit = 20 } = listStuckRunsInputSchema.parse(input)

  if (ids?.length === 0) {
    return listStuckRunsOutputSchema.parse({ runs: [], total: 0 })
  }

  // Only queues with an active run get a baseline. Both parts are index scans: status for the active runs,
  // (queue, status, created_at) for the baselines, which is why the window is on created_at and not finished_at.
  // MATERIALIZED computes each baseline once per queue: inlined, Postgres recomputes it for every active run.
  const result = await db.execute(sql`
    WITH active_runs AS (
      SELECT
        ${jobRunsTable.id} AS id,
        ${jobRunsTable.jobId} AS job_id,
        ${jobRunsTable.queue} AS queue,
        ${jobRunsTable.name} AS name,
        ${jobRunsTable.workerId} AS worker_id,
        ${jobRunsTable.startedAt} AS started_at
      FROM ${jobRunsTable}
      WHERE ${jobRunsTable.status} = 'active'
        AND ${jobRunsTable.startedAt} IS NOT NULL
        ${ids ? sql`AND ${inArray(jobRunsTable.id, ids)}` : sql``}
    ),
    queue_baselines AS MATERIALIZED (
      SELECT active_queues.queue, baseline.p95_ms, baseline.sample_size
      FROM (SELECT DISTINCT queue FROM active_runs) AS active_queues
      CROSS JOIN LATERAL (
        SELECT
          percentile_cont(0.95) WITHIN GROUP (ORDER BY samples.duration_ms) AS p95_ms,
          COUNT(*)::int AS sample_size
        FROM (
          SELECT ${jobRunsTable.durationMs} AS duration_ms
          FROM ${jobRunsTable}
          WHERE ${jobRunsTable.queue} = active_queues.queue
            AND ${jobRunsTable.status} = 'completed'
            AND ${jobRunsTable.createdAt}
              >= (now() AT TIME ZONE 'UTC') - make_interval(days => ${STUCK_BASELINE_DAYS}::int)
            AND ${jobRunsTable.durationMs} IS NOT NULL
          ORDER BY ${jobRunsTable.createdAt} DESC
          LIMIT ${STUCK_MAX_SAMPLES}
        ) AS samples
      ) AS baseline
    ),
    measured_runs AS (
      SELECT
        active_runs.*,
        queue_baselines.p95_ms,
        queue_baselines.sample_size,
        EXTRACT(EPOCH FROM ((now() AT TIME ZONE 'UTC') - active_runs.started_at)) * 1000 AS running_for_ms,
        GREATEST(
          CASE
            WHEN queue_baselines.sample_size < ${STUCK_MIN_SAMPLES}::int
              THEN ${STUCK_LOW_SAMPLE_FLOOR_MS}::double precision
            ELSE ${STUCK_FLOOR_MS}::double precision
          END,
          ${STUCK_P95_MULTIPLIER}::double precision * COALESCE(queue_baselines.p95_ms, 0)
        ) AS threshold_ms
      FROM active_runs
      JOIN queue_baselines ON queue_baselines.queue = active_runs.queue
    )
    SELECT
      id,
      job_id,
      queue,
      name,
      worker_id,
      EXTRACT(EPOCH FROM started_at) * 1000 AS started_at_ms,
      running_for_ms,
      threshold_ms,
      p95_ms,
      sample_size,
      COUNT(*) OVER () AS total
    FROM measured_runs
    WHERE running_for_ms > threshold_ms
    ORDER BY started_at ASC, id ASC
    LIMIT ${limit}
  `)

  const rows = result.rows as StuckRunRow[]

  return listStuckRunsOutputSchema.parse({
    runs: rows.map((row) => ({
      id: row.id,
      jobId: row.job_id,
      queue: row.queue,
      name: row.name,
      workerId: row.worker_id,
      startedAt: Math.round(Number(row.started_at_ms)),
      runningForMs: Math.round(Number(row.running_for_ms)),
      thresholdMs: Math.round(Number(row.threshold_ms)),
      p95Ms: row.p95_ms === null ? null : Math.round(Number(row.p95_ms)),
      sampleSize: Number(row.sample_size),
    })),
    total: Number(rows[0]?.total ?? 0),
  })
}
