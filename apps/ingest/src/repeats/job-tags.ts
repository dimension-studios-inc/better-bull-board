import { db } from "@better-bull-board/db/server";
import { logger } from "@rharkor/logger";
import { sql } from "drizzle-orm";
import cron from "node-cron";
import { withLock } from "~/lib/distributed-lock";
import { env } from "~/lib/env";
import { instanceId } from "~/lib/instance";

const JOB_TAGS_REFRESH_LOCK_KEY = "bbb:job-tags-refresh-lock";
const JOB_TAGS_REFRESH_LOCK_TTL_MS = 1000 * 60 * 29;
const JOB_TAGS_REFRESH_LOOKBACK_MS = 1000 * 60 * 60;

export const refreshRecentJobTags = async () => {
  const createdFrom = new Date(Date.now() - JOB_TAGS_REFRESH_LOOKBACK_MS);
  const retentionMs = env.AUTO_DELETE_POSTGRES_DATA;
  const deleteBefore = retentionMs ? new Date(Date.now() - retentionMs) : undefined;

  await withLock({
    key: JOB_TAGS_REFRESH_LOCK_KEY,
    owner: instanceId,
    ttlMs: JOB_TAGS_REFRESH_LOCK_TTL_MS,
    run: async () => {
      const start = Date.now();
      await db.transaction(async (tx) => {
        await tx.execute(sql`
          INSERT INTO "job_tags" ("tag", "tag_lower", "last_seen_at", "updated_at")
          SELECT
            unnested_tags.tag,
            lower(unnested_tags.tag),
            MAX("job_runs"."created_at")::timestamp,
            now()
          FROM "job_runs"
          CROSS JOIN LATERAL unnest("job_runs"."tags") AS unnested_tags(tag)
          WHERE "job_runs"."created_at" >= ${createdFrom}
            AND cardinality("job_runs"."tags") > 0
            AND unnested_tags.tag IS NOT NULL
            AND unnested_tags.tag <> ''
          GROUP BY unnested_tags.tag
          ON CONFLICT ("tag") DO UPDATE SET
            "tag_lower" = EXCLUDED."tag_lower",
            "last_seen_at" = GREATEST("job_tags"."last_seen_at", EXCLUDED."last_seen_at"),
            "updated_at" = now()
        `);

        if (deleteBefore) {
          await tx.execute(sql`
            DELETE FROM "job_tags"
            WHERE "last_seen_at" < ${deleteBefore}
          `);
        }
      });
      logger.debug("Job tags refresh completed", {
        elapsedMs: Date.now() - start,
      });
    },
  });
};

export const startJobTagsRefresh = () => {
  cron.schedule("*/30 * * * *", () => {
    refreshRecentJobTags().catch((error) => {
      logger.error("Failed to refresh job tags", { error });
    });
  });

  refreshRecentJobTags().catch((error) => {
    logger.error("Failed to refresh job tags on startup", { error });
  });

  logger.log("🏷️ Job tags refresh scheduled every 30 minutes");
};
