import {
  jobRunsTable,
  jobSchedulersTable,
  queuesTable,
} from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { addDays, addHours, startOfDay, startOfHour } from "date-fns";
import { and, asc, desc, eq, gte, ilike, inArray, lt, sql } from "drizzle-orm";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getQueuesTableApiRoute } from "./schemas";

function fillChartData(
  dateFrom: Date,
  dateTo: Date,
  stepKind: string,
  chartData: { timestamp: string; completed: number; failed: number }[],
) {
  const filled: { timestamp: string; completed: number; failed: number }[] = [];
  const map = new Map(
    chartData.map((d) => [
      new Date(d.timestamp).toISOString().slice(0, 19).replace("T", " "),
      d,
    ]),
  );

  for (
    let d = new Date(dateFrom);
    d <= dateTo;
    d = stepKind === "hour" ? addHours(d, 1) : addDays(d, 1)
  ) {
    const ts =
      stepKind === "hour"
        ? startOfHour(d).toISOString().slice(0, 19).replace("T", " ")
        : startOfDay(d).toISOString().slice(0, 19).replace("T", " ");

    if (map.has(ts)) {
      const data = map.get(ts) as {
        timestamp: string;
        completed: number;
        failed: number;
      };
      filled.push({
        ...data,
        completed: Number(data.completed),
        failed: Number(data.failed),
      });
    } else {
      filled.push({ timestamp: ts, completed: 0, failed: 0 });
    }
  }
  return filled;
}

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
        .groupBy(queuesTable.id)
        .orderBy(
          direction === "prev" ? desc(queuesTable.name) : asc(queuesTable.name),
        )
        .limit(limit + 1);
    };

    const rows = await getRows("next");
    const previousRows = cursor ? await getRows("prev") : [];

    const [total] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(queuesTable)
      .where(search ? ilike(queuesTable.name, `%${search}%`) : undefined);

    const queueNames = rows.map((row) => row.name);
    const timePeriodDays = Number(timePeriod);
    const dateFrom = new Date(
      Date.now() - timePeriodDays * 24 * 60 * 60 * 1000,
    );
    const dateTo = new Date();

    const interval = timePeriodDays <= 7 ? "hour" : "day";

    // Performance logging
    const performanceStart = Date.now();

    // Single optimized query to get all queue counts at once
    const countsStart = Date.now();
    const allCounts = await db
      .select({
        queueName: jobRunsTable.queue,
        waitingJobs: sql<number>`COUNT(*) FILTER (WHERE ${jobRunsTable.status} = 'waiting')`,
        activeJobs: sql<number>`COUNT(*) FILTER (WHERE ${jobRunsTable.status} = 'active')`,
        failedJobs: sql<number>`COUNT(*) FILTER (WHERE ${jobRunsTable.status} = 'failed' AND ${jobRunsTable.createdAt} BETWEEN ${dateFrom} AND ${dateTo})`,
        completedJobs: sql<number>`COUNT(*) FILTER (WHERE ${jobRunsTable.status} = 'completed' AND ${jobRunsTable.createdAt} BETWEEN ${dateFrom} AND ${dateTo})`,
        // Pressure is the average time (in ms) spent in waiting state for jobs completed or failed in the time period
        pressure: sql<
          number | null
        >`AVG(EXTRACT(EPOCH FROM (LEAST(${jobRunsTable.startedAt}, ${dateTo}) - GREATEST(${jobRunsTable.enqueuedAt}, ${dateFrom}))) * 1000) FILTER (WHERE (${jobRunsTable.status} = 'completed' OR ${jobRunsTable.status} = 'failed') AND ${jobRunsTable.enqueuedAt} IS NOT NULL AND ${jobRunsTable.startedAt} IS NOT NULL AND ${jobRunsTable.createdAt} BETWEEN ${dateFrom} AND ${dateTo})`,
      })
      .from(jobRunsTable)
      .where(inArray(jobRunsTable.queue, queueNames))
      .groupBy(jobRunsTable.queue);

    const countsTime = Date.now() - countsStart;

    // Single optimized query to get all chart data at once
    const chartStart = Date.now();
    const allChartData = await db
      .select({
        queueName: jobRunsTable.queue,
        timestamp:
          interval === "hour"
            ? sql<string>`date_trunc('hour', ${jobRunsTable.createdAt})`.as(
                "timestamp",
              )
            : sql<string>`date_trunc('day', ${jobRunsTable.createdAt})`.as(
                "timestamp",
              ),
        completed: sql<number>`COUNT(*) FILTER (WHERE ${jobRunsTable.status} = 'completed')`,
        failed: sql<number>`COUNT(*) FILTER (WHERE ${jobRunsTable.status} = 'failed')`,
      })
      .from(jobRunsTable)
      .where(
        and(
          inArray(jobRunsTable.queue, queueNames),
          gte(jobRunsTable.createdAt, dateFrom),
          lt(jobRunsTable.createdAt, dateTo),
        ),
      )
      .groupBy(jobRunsTable.queue, sql`timestamp`)
      .orderBy(jobRunsTable.queue, sql`timestamp`);

    const chartTime = Date.now() - chartStart;

    // Process the results in memory instead of making individual DB calls
    const processStart = Date.now();

    // Create maps for efficient lookup
    const countsMap = new Map(
      allCounts.map((count) => [count.queueName, count]),
    );

    const chartDataMap = new Map<
      string,
      { timestamp: string; completed: number; failed: number }[]
    >();
    for (const chart of allChartData) {
      if (!chartDataMap.has(chart.queueName)) {
        chartDataMap.set(chart.queueName, []);
      }
      chartDataMap.get(chart.queueName)?.push({
        timestamp: chart.timestamp,
        completed: Number(chart.completed),
        failed: Number(chart.failed),
      });
    }

    const queueStats = queueNames.map((queueName) => {
      const counts = countsMap.get(queueName);
      const chartData = chartDataMap.get(queueName) ?? [];

      return {
        queueName,
        waitingJobs: Number(counts?.waitingJobs ?? 0),
        activeJobs: Number(counts?.activeJobs ?? 0),
        failedJobs: Number(counts?.failedJobs ?? 0),
        completedJobs: Number(counts?.completedJobs ?? 0),
        pressure: Number(counts?.pressure ?? 0),
        chartData: fillChartData(dateFrom, dateTo, interval, chartData),
      };
    });

    const processTime = Date.now() - processStart;
    const totalTime = Date.now() - performanceStart;
    if (totalTime > 1000) {
      console.log(
        `[Performance] Total queue stats calculation completed in ${totalTime}ms (Counts: ${countsTime}ms, Chart: ${chartTime}ms, Process: ${processTime}ms)`,
      );
    }

    const statsMap = new Map(queueStats.map((stat) => [stat.queueName, stat]));

    const nextCursor = rows.length > limit ? (rows.pop()?.name ?? null) : null;
    const prevCursor =
      previousRows.length > limit ? (previousRows.at(-2)?.name ?? null) : null;

    return {
      queues: rows.map((row) => {
        const stats = statsMap.get(row.name) ?? {
          queueName: row.name,
          waitingJobs: 0,
          activeJobs: 0,
          failedJobs: 0,
          completedJobs: 0,
          pressure: 0,
          chartData: [],
        };

        return {
          name: row.name,
          isPaused: row.isPaused,
          patterns: row.patterns?.filter(Boolean) ?? [],
          everys: row.everys?.filter(Boolean) ?? [],
          waitingJobs: stats.waitingJobs,
          activeJobs: stats.activeJobs,
          failedJobs: stats.failedJobs,
          completedJobs: stats.completedJobs,
          pressure: stats.pressure,
          chartData: stats.chartData,
        };
      }),
      nextCursor,
      prevCursor,
      total: Number(total?.count ?? 0),
    };
  },
});
