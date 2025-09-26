import { getQueueStatsWithChart } from "@better-bull-board/clickhouse";
import { jobSchedulersTable, queuesTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { and, eq, gt, ilike, sql } from "drizzle-orm";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getQueuesTableApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getQueuesTableApiRoute,
  async handler(input) {
    const { cursor, search, timePeriod, limit } = input;

    // Get queue info from Postgres (basic queue data)
    const rows = await db
      .select({
        id: queuesTable.id,
        name: queuesTable.name,
        isPaused: queuesTable.isPaused,
        pattern: jobSchedulersTable.pattern,
        every: jobSchedulersTable.every,
      })
      .from(queuesTable)
      .leftJoin(
        jobSchedulersTable,
        eq(jobSchedulersTable.queueId, queuesTable.id),
      )
      .where(
        and(
          cursor ? gt(queuesTable.id, cursor) : undefined,
          search ? ilike(queuesTable.name, `%${search}%`) : undefined,
        ),
      )
      .orderBy(queuesTable.id)
      .limit(limit ?? 20);

    const [total] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(queuesTable)
      .where(search ? ilike(queuesTable.name, `%${search}%`) : undefined);

    // Get job run stats from ClickHouse
    const queueNames = rows.map((row) => row.name);
    const timePeriodDays = Number(timePeriod);
    const dateFrom = new Date(
      Date.now() - timePeriodDays * 24 * 60 * 60 * 1000,
    );
    const dateTo = new Date();

    const queueStats = await getQueueStatsWithChart({
      queueNames,
      dateFrom,
      dateTo,
      timePeriod: timePeriodDays,
    });

    // Create a map for quick lookup
    const statsMap = new Map(queueStats.map((stat) => [stat.queueName, stat]));

    return {
      queues: rows.map((row) => {
        const stats = statsMap.get(row.name) ?? {
          queueName: row.name,
          activeJobs: 0,
          failedJobs: 0,
          completedJobs: 0,
          chartData: [],
        };

        return {
          name: row.name,
          isPaused: row.isPaused,
          pattern: row.pattern,
          every: row.every,
          activeJobs: stats.activeJobs,
          failedJobs: stats.failedJobs,
          completedJobs: stats.completedJobs,
          chartData: stats.chartData,
        };
      }),
      nextCursor: rows.length ? (rows[rows.length - 1]?.id ?? null) : null,
      total: Number(total?.count ?? 0),
    };
  },
});
