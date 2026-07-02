import { listQueues } from "@better-bull-board/core/queues";
import { dashboardQueueHourlyStatsTable, jobRunsTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { addDays, addHours, startOfDay, startOfHour } from "date-fns";
import { and, gte, inArray, lt, sql } from "drizzle-orm";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getQueuesTableApiRoute } from "./schemas";

type ChartDataPoint = { timestamp: string; completed: number; failed: number };
type ChartStep = "hour" | "day";

function fillChartData(dateFrom: Date, dateTo: Date, stepKind: ChartStep, chartData: ChartDataPoint[]) {
  const filled: ChartDataPoint[] = [];
  const map = new Map(chartData.map((d) => [new Date(d.timestamp).toISOString().slice(0, 19).replace("T", " "), d]));

  for (let d = new Date(dateFrom); d <= dateTo; d = stepKind === "hour" ? addHours(d, 1) : addDays(d, 1)) {
    const ts =
      stepKind === "hour"
        ? startOfHour(d).toISOString().slice(0, 19).replace("T", " ")
        : startOfDay(d).toISOString().slice(0, 19).replace("T", " ");

    const data = map.get(ts);
    if (data) {
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
    const { search, timePeriod, sortBy, sortDirection } = input;
    const cursorDirection = input.cursorDirection ?? "next";
    const cursor = input.cursor;
    const limit = input.limit ?? 20;
    const timePeriodDays = Number(timePeriod);
    const dateFrom = new Date(Date.now() - timePeriodDays * 24 * 60 * 60 * 1000);
    const dateTo = new Date();
    const pressureDateFrom = startOfHour(dateFrom);
    const pressureDateTo = startOfHour(dateTo);

    const queuePage = await listQueues({
      search,
      cursor,
      cursorDirection,
      sortBy,
      sortDirection,
      limit,
      pressureDateFrom,
      pressureDateTo,
    });
    const queueRows = queuePage.queues;
    const queueNames = queueRows.map((row) => row.name);

    const interval = timePeriodDays <= 7 ? "hour" : "day";

    // Performance logging
    const performanceStart = Date.now();

    const pressureStart = Date.now();
    const allPressureData =
      queueNames.length > 0
        ? await db
            .select({
              queueName: dashboardQueueHourlyStatsTable.queue,
              pressure: sql<number | null>`ROUND(
                SUM(${dashboardQueueHourlyStatsTable.pressureTotalMs})::numeric
                / NULLIF(SUM(${dashboardQueueHourlyStatsTable.pressureCount}), 0)
              )`.as("pressure"),
            })
            .from(dashboardQueueHourlyStatsTable)
            .where(
              and(
                inArray(dashboardQueueHourlyStatsTable.queue, queueNames),
                gte(dashboardQueueHourlyStatsTable.bucketStart, pressureDateFrom),
                lt(dashboardQueueHourlyStatsTable.bucketStart, pressureDateTo),
              ),
            )
            .groupBy(dashboardQueueHourlyStatsTable.queue)
        : [];
    const pressureTime = Date.now() - pressureStart;

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
    const pressureMap = new Map(
      allPressureData.map((pressure) => [pressure.queueName, Number(pressure.pressure ?? 0)]),
    );

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
      const chartData = chartDataMap.get(queueName) ?? [];

      return {
        queueName,
        pressure: pressureMap.get(queueName) ?? 0,
        chartData: fillChartData(dateFrom, dateTo, interval, chartData),
      };
    });

    const processTime = Date.now() - processStart;
    const totalTime = Date.now() - performanceStart;
    if (totalTime > 1000) {
      console.log(
        `[Performance] Total queue stats calculation completed in ${totalTime}ms (Pressure: ${pressureTime}ms, Chart: ${chartTime}ms, Process: ${processTime}ms)`,
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
