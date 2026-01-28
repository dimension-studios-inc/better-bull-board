import { jobRunsTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { and, count, gte, lte, sql } from "drizzle-orm";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getTopQueuesCountApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getTopQueuesCountApiRoute,
  async handler(input) {
    const days = input?.days || 1;
    const limit = input?.limit || 10;
    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const dateTo = new Date();

    try {
      const result = await db
        .select({
          queue: jobRunsTable.queue,
          runCount: count(),
        })
        .from(jobRunsTable)
        .where(and(gte(jobRunsTable.createdAt, dateFrom), lte(jobRunsTable.createdAt, dateTo)))
        .groupBy(jobRunsTable.queue)
        .orderBy(sql`count(*) DESC`)
        .limit(limit);

      return result.map((item) => ({
        queue: item.queue,
        runCount: Number(item.runCount),
      }));
    } catch (error) {
      console.error("Error fetching top queues by run count:", error);
      throw new Error("Failed to fetch top queues by run count");
    }
  },
});
