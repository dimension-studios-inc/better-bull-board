ALTER TABLE "dashboard_queue_hourly_stats"
  ADD COLUMN IF NOT EXISTS "pressure_total_ms" bigint DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "dashboard_queue_hourly_stats"
  ADD COLUMN IF NOT EXISTS "pressure_count" bigint DEFAULT 0 NOT NULL;
--> statement-breakpoint
INSERT INTO "dashboard_queue_hourly_stats" (
  "bucket_start",
  "queue",
  "total_runs",
  "completed_runs",
  "failed_runs",
  "active_runs",
  "waiting_runs",
  "duration_total_ms",
  "duration_count",
  "duration_min_ms",
  "duration_max_ms",
  "pressure_total_ms",
  "pressure_count",
  "updated_at"
)
SELECT
  date_trunc('hour', "created_at")::timestamp AS "bucket_start",
  "queue",
  COUNT(*)::bigint AS "total_runs",
  COUNT(*) FILTER (WHERE "status" = 'completed'::"job_status")::bigint AS "completed_runs",
  COUNT(*) FILTER (WHERE "status" = 'failed'::"job_status")::bigint AS "failed_runs",
  COUNT(*) FILTER (WHERE "status" = 'active'::"job_status")::bigint AS "active_runs",
  COUNT(*) FILTER (WHERE "status" = 'waiting'::"job_status")::bigint AS "waiting_runs",
  COALESCE(
    SUM("duration_ms") FILTER (
      WHERE "status" = 'completed'::"job_status"
        AND "duration_ms" IS NOT NULL
    ),
    0
  )::bigint AS "duration_total_ms",
  COUNT("duration_ms") FILTER (
    WHERE "status" = 'completed'::"job_status"
      AND "duration_ms" IS NOT NULL
  )::bigint AS "duration_count",
  MIN("duration_ms") FILTER (
    WHERE "status" = 'completed'::"job_status"
      AND "duration_ms" IS NOT NULL
  )::integer AS "duration_min_ms",
  MAX("duration_ms") FILTER (
    WHERE "status" = 'completed'::"job_status"
      AND "duration_ms" IS NOT NULL
  )::integer AS "duration_max_ms",
  COALESCE(
    SUM(EXTRACT(EPOCH FROM ("started_at" - "enqueued_at")) * 1000) FILTER (
      WHERE "status" IN ('completed'::"job_status", 'failed'::"job_status")
        AND "enqueued_at" IS NOT NULL
        AND "started_at" IS NOT NULL
    ),
    0
  )::bigint AS "pressure_total_ms",
  COUNT(*) FILTER (
    WHERE "status" IN ('completed'::"job_status", 'failed'::"job_status")
      AND "enqueued_at" IS NOT NULL
      AND "started_at" IS NOT NULL
  )::bigint AS "pressure_count",
  now()
FROM "job_runs"
WHERE "created_at" >= now() - interval '30 days'
GROUP BY date_trunc('hour', "created_at")::timestamp, "queue"
ON CONFLICT ("bucket_start", "queue") DO UPDATE SET
  "pressure_total_ms" = EXCLUDED."pressure_total_ms",
  "pressure_count" = EXCLUDED."pressure_count",
  "updated_at" = now();
