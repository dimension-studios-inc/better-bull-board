import { jobRunsTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { and, avg, count, gte, lte, sql } from "drizzle-orm";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getQueuePerformanceApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getQueuePerformanceApiRoute,
  async handler(input) {
    const days = input?.days || 1;
    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const dateTo = new Date();

    try {
      const result = await db
        .select({
          queue: jobRunsTable.queue,
          totalRuns: count(),
          successes: sql<number>`COUNT(*) FILTER (WHERE ${jobRunsTable.status} = 'completed')`,
          failures: sql<number>`COUNT(*) FILTER (WHERE ${jobRunsTable.status} = 'failed')`,
          avgDuration: avg(
            sql<number>`
              CASE 
                WHEN ${jobRunsTable.status} = 'completed' 
                  AND ${jobRunsTable.startedAt} IS NOT NULL 
                  AND ${jobRunsTable.finishedAt} IS NOT NULL
                THEN EXTRACT(EPOCH FROM (${jobRunsTable.finishedAt} - ${jobRunsTable.startedAt}))
                ELSE NULL
              END
            `,
          ),
        })
        .from(jobRunsTable)
        .where(
          and(
            gte(jobRunsTable.createdAt, dateFrom),
            lte(jobRunsTable.createdAt, dateTo),
          ),
        )
        .groupBy(jobRunsTable.queue)
        .orderBy(sql`count(*) DESC`);

      return result.map((item) => ({
        queue: item.queue,
        totalRuns: Number(item.totalRuns),
        successes: Number(item.successes),
        failures: Number(item.failures),
        errorRate:
          item.totalRuns > 0
            ? (Number(item.failures) / Number(item.totalRuns)) * 100
            : 0,
        avgDuration: Number(item.avgDuration) || 0,
      }));
    } catch (error) {
      console.error("Error fetching queue performance data:", error);
      throw new Error("Failed to fetch queue performance data");
    }
  },
});
