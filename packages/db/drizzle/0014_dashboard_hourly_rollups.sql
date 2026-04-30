CREATE TABLE IF NOT EXISTS "dashboard_queue_hourly_stats" (
	"bucket_start" timestamp (3) NOT NULL,
	"queue" text NOT NULL,
	"total_runs" bigint DEFAULT 0 NOT NULL,
	"completed_runs" bigint DEFAULT 0 NOT NULL,
	"failed_runs" bigint DEFAULT 0 NOT NULL,
	"active_runs" bigint DEFAULT 0 NOT NULL,
	"waiting_runs" bigint DEFAULT 0 NOT NULL,
	"duration_total_ms" bigint DEFAULT 0 NOT NULL,
	"duration_count" bigint DEFAULT 0 NOT NULL,
	"duration_min_ms" integer,
	"duration_max_ms" integer,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "pk_dashboard_queue_hourly_stats" PRIMARY KEY("bucket_start","queue")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_dashboard_queue_hourly_stats_bucket" ON "dashboard_queue_hourly_stats" USING btree ("bucket_start");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_dashboard_queue_hourly_stats_queue_bucket" ON "dashboard_queue_hourly_stats" USING btree ("queue","bucket_start");
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
	COALESCE(SUM("duration_ms") FILTER (WHERE "status" = 'completed'::"job_status" AND "duration_ms" IS NOT NULL), 0)::bigint AS "duration_total_ms",
	COUNT("duration_ms") FILTER (WHERE "status" = 'completed'::"job_status" AND "duration_ms" IS NOT NULL)::bigint AS "duration_count",
	MIN("duration_ms") FILTER (WHERE "status" = 'completed'::"job_status" AND "duration_ms" IS NOT NULL)::integer AS "duration_min_ms",
	MAX("duration_ms") FILTER (WHERE "status" = 'completed'::"job_status" AND "duration_ms" IS NOT NULL)::integer AS "duration_max_ms",
	now()
FROM "job_runs"
WHERE "created_at" >= now() - interval '30 days'
GROUP BY date_trunc('hour', "created_at")::timestamp, "queue"
ON CONFLICT ("bucket_start", "queue") DO UPDATE SET
	"total_runs" = EXCLUDED."total_runs",
	"completed_runs" = EXCLUDED."completed_runs",
	"failed_runs" = EXCLUDED."failed_runs",
	"active_runs" = EXCLUDED."active_runs",
	"waiting_runs" = EXCLUDED."waiting_runs",
	"duration_total_ms" = EXCLUDED."duration_total_ms",
	"duration_count" = EXCLUDED."duration_count",
	"duration_min_ms" = EXCLUDED."duration_min_ms",
	"duration_max_ms" = EXCLUDED."duration_max_ms",
	"updated_at" = now();
