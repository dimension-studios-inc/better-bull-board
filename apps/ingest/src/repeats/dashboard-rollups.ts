import { db } from "@better-bull-board/db/server";
import { logger } from "@rharkor/logger";
import { sql } from "drizzle-orm";
import cron from "node-cron";
import { withLock } from "~/lib/distributed-lock";
import { env } from "~/lib/env";
import { instanceId } from "~/lib/instance";

const DASHBOARD_ROLLUP_LOCK_KEY = "bbb:dashboard-rollups-lock";
const DASHBOARD_ROLLUP_LOCK_TTL_MS = 1000 * 60 * 55;
const DASHBOARD_ROLLUP_RETENTION_MS = 1000 * 60 * 60 * 24 * 30;

export const refreshLastCompletedDashboardRollupHour = async () => {
  const retentionMs = env.AUTO_DELETE_POSTGRES_DATA ?? DASHBOARD_ROLLUP_RETENTION_MS;
  const deleteBefore = new Date(Date.now() - retentionMs);

  await withLock({
    key: DASHBOARD_ROLLUP_LOCK_KEY,
    owner: instanceId,
    ttlMs: DASHBOARD_ROLLUP_LOCK_TTL_MS,
    run: async () => {
      await db.transaction(async (tx) => {
        await tx.execute(sql`
          DELETE FROM "dashboard_queue_hourly_stats"
          WHERE "bucket_start" = date_trunc('hour', now() - interval '1 hour')::timestamp
        `);

        await tx.execute(sql`
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
            COALESCE(
              SUM("duration_ms") FILTER (WHERE "status" = 'completed'::"job_status" AND "duration_ms" IS NOT NULL),
              0
            )::bigint AS "duration_total_ms",
            COUNT("duration_ms") FILTER (
              WHERE "status" = 'completed'::"job_status" AND "duration_ms" IS NOT NULL
            )::bigint AS "duration_count",
            MIN("duration_ms") FILTER (
              WHERE "status" = 'completed'::"job_status" AND "duration_ms" IS NOT NULL
            )::integer AS "duration_min_ms",
            MAX("duration_ms") FILTER (
              WHERE "status" = 'completed'::"job_status" AND "duration_ms" IS NOT NULL
            )::integer AS "duration_max_ms",
            now()
          FROM "job_runs"
          WHERE "created_at" >= date_trunc('hour', now() - interval '1 hour')::timestamp
            AND "created_at" < date_trunc('hour', now())::timestamp
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
            "updated_at" = now()
        `);

        await tx.execute(sql`
          DELETE FROM "dashboard_queue_hourly_stats"
          WHERE "bucket_start" < ${deleteBefore}
        `);
      });
    },
  });
};

export const startDashboardRollups = () => {
  cron.schedule("0 * * * *", () => {
    refreshLastCompletedDashboardRollupHour().catch((error) => {
      logger.error("Failed to refresh dashboard rollups", { error });
    });
  });

  logger.log("📊 Dashboard rollups scheduled hourly");
};
