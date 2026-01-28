import { jobRunsTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { and, count, eq, gte, lte } from "drizzle-orm";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getEnhancedStatsApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getEnhancedStatsApiRoute,
  async handler(input) {
    const days = input?.days || 1;
    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const dateTo = new Date();

    const [runningTasksResult, waitingInQueueResult, successesResult, failuresResult] = await Promise.all([
      // Count active/running tasks
      db
        .select({ count: count() })
        .from(jobRunsTable)
        .where(eq(jobRunsTable.status, "active")),

      // Count waiting tasks
      db
        .select({ count: count() })
        .from(jobRunsTable)
        .where(eq(jobRunsTable.status, "waiting")),

      // Count completed tasks within date range
      db
        .select({ count: count() })
        .from(jobRunsTable)
        .where(
          and(
            eq(jobRunsTable.status, "completed"),
            gte(jobRunsTable.createdAt, dateFrom),
            lte(jobRunsTable.createdAt, dateTo),
          ),
        ),

      // Count failed tasks within date range
      db
        .select({ count: count() })
        .from(jobRunsTable)
        .where(
          and(
            eq(jobRunsTable.status, "failed"),
            gte(jobRunsTable.createdAt, dateFrom),
            lte(jobRunsTable.createdAt, dateTo),
          ),
        ),
    ]);

    return {
      runningTasks: runningTasksResult[0]?.count || 0,
      waitingInQueue: waitingInQueueResult[0]?.count || 0,
      successes: successesResult[0]?.count || 0,
      failures: failuresResult[0]?.count || 0,
    };
  },
});
