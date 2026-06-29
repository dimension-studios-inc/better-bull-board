import { listQueues } from "@better-bull-board/core/queues";
import { jobRunsTable, jobSchedulersTable, queuesTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { addDays, addHours, startOfDay, startOfHour } from "date-fns";
import { and, asc, desc, eq, gt, gte, ilike, inArray, isNotNull, lt, or, sql } from "drizzle-orm";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getQueuesTableApiRoute } from "./schemas";

type QueueCursor = {
  waitingJobs: number;
  activeJobs?: number;
  pressure?: number;
  name: string;
};

type SortDirection = "asc" | "desc";
type CursorDirection = "next" | "prev";

const pressureAverageExpression = sql<
  number | null
>`ROUND(AVG(EXTRACT(EPOCH FROM (${jobRunsTable.startedAt} - ${jobRunsTable.enqueuedAt})) * 1000))`;
const pressureFilters = (dateFrom: Date, dateTo: Date) =>
  and(
    inArray(jobRunsTable.status, ["completed", "failed"]),
    isNotNull(jobRunsTable.enqueuedAt),
    isNotNull(jobRunsTable.startedAt),
    gte(jobRunsTable.createdAt, dateFrom),
    lt(jobRunsTable.createdAt, dateTo),
  );

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

const waitingJobCounts = db
  .select({
    queue: jobRunsTable.queue,
    waitingJobs: sql<number>`COUNT(*)::int`.as("waiting_jobs"),
  })
  .from(jobRunsTable)
  .where(eq(jobRunsTable.status, "waiting"))
  .groupBy(jobRunsTable.queue)
  .as("waiting_job_counts");

const activeJobCounts = db
  .select({
    queue: jobRunsTable.queue,
    activeJobs: sql<number>`COUNT(*)::int`.as("active_jobs"),
  })
  .from(jobRunsTable)
  .where(eq(jobRunsTable.status, "active"))
  .groupBy(jobRunsTable.queue)
  .as("active_job_counts");

const getPressureStats = (dateFrom: Date, dateTo: Date) =>
  db
    .select({
      queue: jobRunsTable.queue,
      pressure: pressureAverageExpression.as("pressure"),
    })
    .from(jobRunsTable)
    .where(pressureFilters(dateFrom, dateTo))
    .groupBy(jobRunsTable.queue)
    .as("pressure_stats");

const waitingJobsExpression = sql<number>`COALESCE(${waitingJobCounts.waitingJobs}, 0)`;
const activeJobsExpression = sql<number>`COALESCE(${activeJobCounts.activeJobs}, 0)`;

const getPressureExpression = (dateFrom: Date, dateTo: Date) => {
  const pressureStats = getPressureStats(dateFrom, dateTo);
  return {
    expression: sql<number>`COALESCE(${pressureStats.pressure}, 0)`,
    table: pressureStats,
  };
};

const getPressureCursorComparison = (
  cursor: QueueCursor,
  cursorDirection: CursorDirection,
  sortDirection: SortDirection,
  pressureExpression: ReturnType<typeof getPressureExpression>["expression"],
) => {
  const cursorValue = cursor.pressure ?? 0;
  const nameComparison =
    cursorDirection === "next" ? gt(queuesTable.name, cursor.name) : lt(queuesTable.name, cursor.name);
  const tiedSortComparison = and(eq(pressureExpression, cursorValue), nameComparison);
  const shouldUseGreaterThan = cursorDirection === "next" ? sortDirection === "asc" : sortDirection === "desc";

  if (shouldUseGreaterThan) {
    return or(gt(pressureExpression, cursorValue), tiedSortComparison);
  }

  return or(lt(pressureExpression, cursorValue), tiedSortComparison);
};

const getPressureSortOrder = (
  cursorDirection: CursorDirection,
  sortDirection: SortDirection,
  pressureExpression: ReturnType<typeof getPressureExpression>["expression"],
) => {
  const orderDirection = cursorDirection === "next" ? sortDirection : sortDirection === "desc" ? "asc" : "desc";
  const sortOrder = orderDirection === "asc" ? asc(pressureExpression) : desc(pressureExpression);
  const nameOrder = cursorDirection === "next" ? asc(queuesTable.name) : desc(queuesTable.name);

  return [sortOrder, nameOrder];
};

const listQueuesByPressure = async ({
  cursor,
  cursorDirection,
  dateFrom,
  dateTo,
  limit,
  search,
  sortDirection,
}: {
  cursor: QueueCursor | null | undefined;
  cursorDirection: CursorDirection;
  dateFrom: Date;
  dateTo: Date;
  limit: number;
  search: string | undefined;
  sortDirection: SortDirection;
}) => {
  const pressure = getPressureExpression(dateFrom, dateTo);
  const rows = await db
    .select({
      id: queuesTable.id,
      name: queuesTable.name,
      isPaused: queuesTable.isPaused,
      waitingJobs: waitingJobsExpression.as("waiting_jobs"),
      activeJobs: activeJobsExpression.as("active_jobs"),
      pressure: pressure.expression.as("pressure"),
      patterns: sql<string[] | null | undefined>`array_agg(${jobSchedulersTable.pattern})`.as("patterns"),
      everys: sql<number[] | null | undefined>`array_agg(${jobSchedulersTable.every})`.as("everys"),
    })
    .from(queuesTable)
    .leftJoin(waitingJobCounts, eq(waitingJobCounts.queue, queuesTable.name))
    .leftJoin(activeJobCounts, eq(activeJobCounts.queue, queuesTable.name))
    .leftJoin(pressure.table, eq(pressure.table.queue, queuesTable.name))
    .leftJoin(jobSchedulersTable, eq(jobSchedulersTable.queueId, queuesTable.id))
    .where(
      and(
        cursor ? getPressureCursorComparison(cursor, cursorDirection, sortDirection, pressure.expression) : undefined,
        search ? ilike(queuesTable.name, `%${search}%`) : undefined,
      ),
    )
    .groupBy(queuesTable.id, waitingJobCounts.waitingJobs, activeJobCounts.activeJobs, pressure.table.pressure)
    .orderBy(...getPressureSortOrder(cursorDirection, sortDirection, pressure.expression))
    .limit(limit + 1);

  const hasExtra = rows.length > limit;

  if (hasExtra) {
    rows.pop();
  }

  const queueRows = cursorDirection === "prev" ? rows.reverse() : rows;
  const [total] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(queuesTable)
    .where(search ? ilike(queuesTable.name, `%${search}%`) : undefined);
  const firstRow = queueRows[0];
  const lastRow = queueRows.at(-1);
  const hasNewerPage = cursorDirection === "next" ? Boolean(cursor) : hasExtra;
  const hasOlderPage = cursorDirection === "prev" ? Boolean(cursor) : hasExtra;

  return {
    queues: queueRows.map((row) => ({
      name: row.name,
      isPaused: row.isPaused,
      patterns: row.patterns?.filter(Boolean) ?? [],
      everys: row.everys?.filter(Boolean) ?? [],
      waitingJobs: Number(row.waitingJobs ?? 0),
      activeJobs: Number(row.activeJobs ?? 0),
      pressure: Number(row.pressure ?? 0),
    })),
    nextCursor:
      hasOlderPage && lastRow
        ? {
            name: lastRow.name,
            waitingJobs: Number(lastRow.waitingJobs ?? 0),
            activeJobs: Number(lastRow.activeJobs ?? 0),
            pressure: Number(lastRow.pressure ?? 0),
          }
        : null,
    prevCursor:
      hasNewerPage && firstRow
        ? {
            name: firstRow.name,
            waitingJobs: Number(firstRow.waitingJobs ?? 0),
            activeJobs: Number(firstRow.activeJobs ?? 0),
            pressure: Number(firstRow.pressure ?? 0),
          }
        : null,
    total: Number(total?.count ?? 0),
  };
};

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

    const queuePage =
      sortBy === "pressure"
        ? await listQueuesByPressure({
            cursor,
            cursorDirection,
            dateFrom,
            dateTo,
            limit,
            search,
            sortDirection,
          })
        : await listQueues({
            search,
            cursor,
            cursorDirection,
            sortBy,
            sortDirection,
            limit,
          });
    const queueRows = queuePage.queues;
    const queueNames = queueRows.map((row) => row.name);

    const interval = timePeriodDays <= 7 ? "hour" : "day";

    // Performance logging
    const performanceStart = Date.now();

    // Single optimized query to get all queue counts at once
    const countsStart = Date.now();
    const allCounts =
      sortBy === "pressure"
        ? queueRows.map((row) => ({ name: row.name, pressure: "pressure" in row ? row.pressure : 0 }))
        : queueNames.length > 0
          ? await db
              .select({
                name: jobRunsTable.queue,
                pressure: pressureAverageExpression.as("pressure"),
              })
              .from(jobRunsTable)
              .where(and(inArray(jobRunsTable.queue, queueNames), pressureFilters(dateFrom, dateTo)))
              .groupBy(jobRunsTable.queue)
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
    const getCursorWithPressure = (cursor: typeof queuePage.nextCursor) =>
      cursor
        ? {
            ...cursor,
            pressure: statsMap.get(cursor.name)?.pressure ?? 0,
          }
        : null;

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
      nextCursor: getCursorWithPressure(queuePage.nextCursor),
      prevCursor: getCursorWithPressure(queuePage.prevCursor),
      total: queuePage.total,
    };
  },
});
