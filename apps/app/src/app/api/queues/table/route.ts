import { getQueueStatsWithChart } from "@better-bull-board/clickhouse";
import { jobSchedulersTable, queuesTable, workersTable, workerStatsTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { and, asc, desc, eq, gte, ilike, lt, sql } from "drizzle-orm";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getQueuesTableApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getQueuesTableApiRoute,
  async handler(input) {
    const { cursor, search, timePeriod } = input;
    const limit = input.limit ?? 20;

    const getRows = async (direction: "next" | "prev") => {
      return db
        .select({
          id: queuesTable.id,
          name: queuesTable.name,
          isPaused: queuesTable.isPaused,
          patterns: sql<
            string[] | null | undefined
          >`array_agg(${jobSchedulersTable.pattern})`.as("patterns"),
          everys: sql<
            number[] | null | undefined
          >`array_agg(${jobSchedulersTable.every})`.as("everys"),
        })
        .from(queuesTable)
        .leftJoin(
          jobSchedulersTable,
          eq(jobSchedulersTable.queueId, queuesTable.id),
        )
        .where(
          and(
            cursor
              ? direction === "prev"
                ? lt(queuesTable.name, cursor)
                : gte(queuesTable.name, cursor)
              : undefined,
            search ? ilike(queuesTable.name, `%${search}%`) : undefined,
          ),
        )
        .groupBy(queuesTable.id) // ✅ ensures one row per queue
        .orderBy(
          direction === "prev" ? desc(queuesTable.name) : asc(queuesTable.name),
        )
        .limit(limit + 1);
    };

    // Get queue info from Postgres (basic queue data)
    const rows = await getRows("next");
    const previousRows = cursor ? await getRows("prev") : [];

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

    // Get worker statistics for all queues
    const workerStats = await db
      .select({
        queueName: workersTable.queueName,
        totalWorkers: sql<number>`COUNT(*)`,
        activeWorkers: sql<number>`SUM(CASE WHEN ${workersTable.isActive} THEN 1 ELSE 0 END)`,
        avgMemoryUsage: sql<number>`COALESCE(AVG(${workerStatsTable.memoryUsagePercent}), 0)`,
        avgCpuUsage: sql<number>`COALESCE(AVG(${workerStatsTable.cpuUsagePercent}), 0)`,
      })
      .from(workersTable)
      .leftJoin(
        workerStatsTable,
        and(
          eq(workerStatsTable.workerId, workersTable.workerId),
          gte(workerStatsTable.recordedAt, new Date(Date.now() - 5 * 60 * 1000)) // Last 5 minutes of stats
        )
      )
      .where(search ? ilike(workersTable.queueName, `%${search}%`) : undefined)
      .groupBy(workersTable.queueName);

    const workerStatsMap = new Map(
      workerStats.map((stat) => [
        stat.queueName,
        {
          total: Number(stat.totalWorkers || 0),
          active: Number(stat.activeWorkers || 0),
          averageMemoryUsage: Number(stat.avgMemoryUsage || 0),
          averageCpuUsage: Number(stat.avgCpuUsage || 0),
        },
      ])
    );

    const nextCursor = rows.length > limit ? (rows.pop()?.name ?? null) : null;
    const prevCursor =
      previousRows.length > limit ? (previousRows.at(-2)?.name ?? null) : null;

    return {
      queues: rows.map((row) => {
        const stats = statsMap.get(row.name) ?? {
          queueName: row.name,
          activeJobs: 0,
          failedJobs: 0,
          completedJobs: 0,
          chartData: [],
        };

        const workers = workerStatsMap.get(row.name) ?? {
          total: 0,
          active: 0,
          averageMemoryUsage: 0,
          averageCpuUsage: 0,
        };

        return {
          name: row.name,
          isPaused: row.isPaused,
          patterns: row.patterns?.filter(Boolean) ?? [],
          everys: row.everys?.filter(Boolean) ?? [],
          activeJobs: stats.activeJobs,
          failedJobs: stats.failedJobs,
          completedJobs: stats.completedJobs,
          chartData: stats.chartData,
          workers,
        };
      }),
      nextCursor,
      prevCursor,
      total: Number(total?.count ?? 0),
    };
  },
});
