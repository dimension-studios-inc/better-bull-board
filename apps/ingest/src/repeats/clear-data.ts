import { jobRunsTable, workersTable, workerStatsTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { logger } from "@rharkor/logger";
import { formatDistance } from "date-fns";
import { lt, and, isNotNull } from "drizzle-orm";
import { env } from "~/lib/env";
import { markInactiveWorkers } from "~/channels/liveness";

// we want do delete old data such as job runs and job logs after AUTO_DELETE_POSTGRES_DATA
export const clearData = async () => {
  const autoDeletePostgresData = env.AUTO_DELETE_POSTGRES_DATA;
  if (!autoDeletePostgresData) return;

  const deleteData = async () => {
    const now = new Date();
    const deleteDate = new Date(now.getTime() - autoDeletePostgresData);

    // Delete job runs
    //? This will delete logs too
    const jobRunsResult = await db.delete(jobRunsTable).where(lt(jobRunsTable.createdAt, deleteDate));
    
    // Delete old worker stats
    const workerStatsResult = await db.delete(workerStatsTable).where(lt(workerStatsTable.recordedAt, deleteDate));
    
    // Delete inactive workers that have been inactive for longer than AUTO_DELETE_POSTGRES_DATA
    const workersResult = await db.delete(workersTable).where(
      and(
        isNotNull(workersTable.inactiveSince),
        lt(workersTable.inactiveSince, deleteDate)
      )
    );

    if (jobRunsResult.rowCount || workerStatsResult.rowCount || workersResult.rowCount) {
      logger.info("Cleaned up old data", {
        jobRuns: jobRunsResult.rowCount || 0,
        workerStats: workerStatsResult.rowCount || 0,
        workers: workersResult.rowCount || 0,
      });
    }
  };

  setInterval(
    () => {
      deleteData();
    },
    1000 * 60 * 60, // Every hour
  );
  deleteData();

  // Mark inactive workers every minute
  setInterval(
    () => {
      markInactiveWorkers();
    },
    1000 * 60, // Every minute
  );
  markInactiveWorkers(); // Run immediately

  logger.log(
    `🧹 Clearing data every ${formatDistance(autoDeletePostgresData, 0)}`,
  );
  logger.log("🔍 Checking for inactive workers every minute");
};
