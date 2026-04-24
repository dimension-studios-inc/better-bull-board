import { jobRunsTable } from "@better-bull-board/db/schemas/job/schema";
import { db } from "@better-bull-board/db/server";
import { logger } from "@rharkor/logger";
import { formatDistance } from "date-fns";
import { lt } from "drizzle-orm";
import { withLock } from "~/lib/distributed-lock";
import { env } from "~/lib/env";
import { instanceId } from "~/lib/instance";

// we want do delete old data such as job runs and job logs after AUTO_DELETE_POSTGRES_DATA
export const clearData = async () => {
  const autoDeletePostgresData = env.AUTO_DELETE_POSTGRES_DATA;
  if (!autoDeletePostgresData) return;

  const deleteData = async () => {
    await withLock({
      key: "bbb:postgres-retention-lock",
      owner: instanceId,
      ttlMs: 1000 * 60 * 30,
      run: async () => {
        const now = new Date();
        const deleteDate = new Date(now.getTime() - autoDeletePostgresData);

        // Delete job runs
        //? This will delete logs too
        await db.delete(jobRunsTable).where(lt(jobRunsTable.createdAt, deleteDate));
      },
    });
  };

  setInterval(
    () => {
      deleteData();
    },
    1000 * 60 * 60,
  );
  deleteData();

  logger.log(`🧹 Clearing data every ${formatDistance(autoDeletePostgresData, 0)}`);
};
