import { listQueues } from "@better-bull-board/core/queues";
import { jobRunsTable, queuesTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { addDays, addHours, startOfDay, startOfHour } from "date-fns";
import { and, gte, inArray, lt, sql } from "drizzle-orm";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getQueuesTableApiRoute } from "./schemas";

function fillChartData(
  dateFrom: Date,
  dateTo: Date,
  stepKind: string,
  chartData: { timestamp: string; completed: number; failed: number }[],
) {
  const filled: { timestamp: string; completed: number; failed: number }[] = [];
  const map = new Map(chartData.map((d) => [new Date(d.timestamp).toISOString().slice(0, 19).replace("T", " "), d]));

  for (let d = new Date(dateFrom); d <= dateTo; d = stepKind === "hour" ? addHours(d, 1) : addDays(d, 1)) {
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
    const { search, timePeriod } = input;
    const cursorDirection = input.cursorDirection ?? "next";
    const cursor = input.cursor;
    const limit = input.limit ?? 20;

    const queuePage = await listQueues({
      search,
      cursor,
      cursorDirection,
      limit,
    });
    const queueRows = queuePage.queues;

    const queueNames = queueRows.map((row) => row.name);
    const timePeriodDays = Number(timePeriod);
    const dateFrom = new Date(Date.now() - timePeriodDays * 24 * 60 * 60 * 1000);
    const dateTo = new Date();

    const interval = timePeriodDays <= 7 ? "hour" : "day";

    // Performance logging
    const performanceStart = Date.now();

    // Single optimized query to get all queue counts at once
    const countsStart = Date.now();
    const allCounts =
      queueNames.length > 0
        ? await db
            .select({
              name: queuesTable.name,
              // Pressure is the average time (in ms) spent in waiting state for jobs completed or failed in the time period
              pressure: sql<number | null>`(
          SELECT ROUND(AVG(EXTRACT(EPOCH FROM (jra."started_at" - jra."enqueued_at")) * 1000)) as pressure
          FROM (
            SELECT *
            FROM ${jobRunsTable} jra
            WHERE jra.queue = queues.name
            AND (jra.status = 'completed' OR jra.status = 'failed')
            AND jra.enqueued_at IS NOT NULL
            AND jra.started_at IS NOT NULL
            AND jra.created_at >= ${dateFrom}
            AND jra.created_at < ${dateTo}
            ORDER BY jra.created_at DESC
            LIMIT 100
          ) jra
        )`.as("pressure"),
            })
            .from(queuesTable)
            .where(inArray(queuesTable.name, queueNames))
        : [];

    const countsTime = Date.now() - countsStart;

    // Single optimized query to get all chart data at once
    const chartStart = Date.now();
    const allChartData =
      queueNames.length > 0
        ? await db
            .select({
              queueName: jobRunsTable.queue,
              timestamp:
                interval === "hour"
                  ? sql<string>`date_trunc('hour', ${jobRunsTable.createdAt})`.as("timestamp")
                  : sql<string>`date_trunc('day', ${jobRunsTable.createdAt})`.as("timestamp"),
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
            .orderBy(jobRunsTable.queue, sql`timestamp`)
        : [];

    const chartTime = Date.now() - chartStart;

    // Process the results in memory instead of making individual DB calls
    const processStart = Date.now();

    // Create maps for efficient lookup
    const countsMap = new Map(allCounts.map((count) => [count.name, count]));

    const chartDataMap = new Map<string, { timestamp: string; completed: number; failed: number }[]>();
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

    return {
      queues: queueRows.map((row) => {
        const stats = statsMap.get(row.name) ?? {
          queueName: row.name,
          pressure: 0,
          chartData: [],
        };

        return {
          name: row.name,
          isPaused: row.isPaused,
          patterns: row.patterns?.filter(Boolean) ?? [],
          everys: row.everys?.filter(Boolean) ?? [],
          waitingJobs: row.waitingJobs,
          activeJobs: row.activeJobs,
          pressure: stats.pressure,
          chartData: stats.chartData,
        };
      }),
      nextCursor: queuePage.nextCursor,
      prevCursor: queuePage.prevCursor,
      total: queuePage.total,
    };
  },
});
