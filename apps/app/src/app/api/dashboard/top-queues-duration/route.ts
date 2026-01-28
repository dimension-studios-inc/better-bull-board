import { jobRunsTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { and, gte, lte, sql, sum } from "drizzle-orm";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getTopQueuesDurationApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getTopQueuesDurationApiRoute,
  async handler(input) {
    const days = input?.days || 1;
    const limit = input?.limit || 10;
    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const dateTo = new Date();

    try {
      const result = await db
        .select({
          queue: jobRunsTable.queue,
          totalDuration: sum(
            sql<number>`
              CASE 
                WHEN ${jobRunsTable.status} = 'completed'
                  AND ${jobRunsTable.startedAt} IS NOT NULL 
                  AND ${jobRunsTable.finishedAt} IS NOT NULL
                THEN EXTRACT(EPOCH FROM (${jobRunsTable.finishedAt} - ${jobRunsTable.startedAt}))
                ELSE 0
              END
            `,
          ),
        })
        .from(jobRunsTable)
        .where(and(gte(jobRunsTable.createdAt, dateFrom), lte(jobRunsTable.createdAt, dateTo)))
        .groupBy(jobRunsTable.queue)
        .having(sql`sum(
          CASE 
            WHEN ${jobRunsTable.status} = 'completed'
              AND ${jobRunsTable.startedAt} IS NOT NULL 
              AND ${jobRunsTable.finishedAt} IS NOT NULL
            THEN EXTRACT(EPOCH FROM (${jobRunsTable.finishedAt} - ${jobRunsTable.startedAt}))
            ELSE 0
          END
        ) > 0`)
        .orderBy(sql`sum(
          CASE 
            WHEN ${jobRunsTable.status} = 'completed'
              AND ${jobRunsTable.startedAt} IS NOT NULL 
              AND ${jobRunsTable.finishedAt} IS NOT NULL
            THEN EXTRACT(EPOCH FROM (${jobRunsTable.finishedAt} - ${jobRunsTable.startedAt}))
            ELSE 0
          END
        ) DESC`)
        .limit(limit);

      return result.map((item) => ({
        queue: item.queue,
        totalDuration: Number(item.totalDuration),
      }));
    } catch (error) {
      console.error("Error fetching top queues by duration:", error);
      throw new Error("Failed to fetch top queues by duration");
    }
  },
});
