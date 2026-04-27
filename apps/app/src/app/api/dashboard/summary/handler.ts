import { dashboardQueueHourlyStatsTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { addDays, addHours, startOfDay, startOfHour } from "date-fns";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import type { getDashboardSummaryOutput } from "~/app/api/dashboard/summary/schemas";

export type DashboardSummary = z.output<typeof getDashboardSummaryOutput>;

type StatsRow = {
  running_tasks: string | number | null;
  waiting_in_queue: string | number | null;
  successes: string | number | null;
  failures: string | number | null;
};

type QueuePerformanceRow = {
  queue: string;
  total_runs: string | number;
  successes: string | number;
  failures: string | number;
  duration_total_ms: string | number | null;
  duration_count: string | number | null;
  min_duration_ms: string | number | null;
  max_duration_ms: string | number | null;
};

type RunGraphRow = {
  timestamp: string | Date;
  run_count: string | number;
};

type DashboardWindow = {
  bucketFrom: Date;
  dateTo: Date;
  graphInterval: "hour" | "day";
};

const toNumber = (value: string | number | null | undefined) => Number(value ?? 0);

const toSeconds = (milliseconds: string | number | null | undefined) => toNumber(milliseconds) / 1000;

const formatSqlTimestamp = (value: string | Date) => new Date(value).toISOString().slice(0, 19).replace("T", " ");

const getDashboardWindow = (days: number): DashboardWindow => {
  const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const dateTo = new Date();

  return {
    bucketFrom: days <= 7 ? startOfHour(dateFrom) : startOfDay(dateFrom),
    dateTo,
    graphInterval: days <= 7 ? "hour" : "day",
  };
};

const getStats = async ({ bucketFrom, dateTo }: DashboardWindow) => {
  const result = await db.execute(sql`
      SELECT
        COALESCE(SUM("active_runs"), 0)::bigint AS "running_tasks",
        COALESCE(SUM("waiting_runs"), 0)::bigint AS "waiting_in_queue",
        COALESCE(SUM("completed_runs") FILTER (WHERE "bucket_start" >= ${bucketFrom} AND "bucket_start" <= ${dateTo}), 0)::bigint AS "successes",
        COALESCE(SUM("failed_runs") FILTER (WHERE "bucket_start" >= ${bucketFrom} AND "bucket_start" <= ${dateTo}), 0)::bigint AS "failures"
      FROM ${dashboardQueueHourlyStatsTable}
    `);
  const stats = (result.rows as StatsRow[])[0];

  return {
    runningTasks: toNumber(stats?.running_tasks),
    waitingInQueue: toNumber(stats?.waiting_in_queue),
    successes: toNumber(stats?.successes),
    failures: toNumber(stats?.failures),
  };
};

const getQueuePerformance = async ({ bucketFrom, dateTo }: DashboardWindow) => {
  const result = await db.execute(sql`
      SELECT
        "queue",
        COALESCE(SUM("total_runs"), 0)::bigint AS "total_runs",
        COALESCE(SUM("completed_runs"), 0)::bigint AS "successes",
        COALESCE(SUM("failed_runs"), 0)::bigint AS "failures",
        COALESCE(SUM("duration_total_ms"), 0)::bigint AS "duration_total_ms",
        COALESCE(SUM("duration_count"), 0)::bigint AS "duration_count",
        MIN("duration_min_ms") AS "min_duration_ms",
        MAX("duration_max_ms") AS "max_duration_ms"
      FROM ${dashboardQueueHourlyStatsTable}
      WHERE "bucket_start" >= ${bucketFrom}
        AND "bucket_start" <= ${dateTo}
      GROUP BY "queue"
      ORDER BY SUM("total_runs") DESC
    `);

  return (result.rows as QueuePerformanceRow[]).map((row) => {
    const totalRuns = toNumber(row.total_runs);
    const successes = toNumber(row.successes);
    const failures = toNumber(row.failures);
    const durationCount = toNumber(row.duration_count);
    const durationTotalMs = toNumber(row.duration_total_ms);

    return {
      queue: row.queue,
      totalRuns,
      successes,
      failures,
      errorRate: totalRuns > 0 ? (failures / totalRuns) * 100 : 0,
      avgDuration: durationCount > 0 ? durationTotalMs / durationCount / 1000 : 0,
      minDuration: toSeconds(row.min_duration_ms),
      maxDuration: toSeconds(row.max_duration_ms),
    };
  });
};

const getRunGraphRows = async ({ bucketFrom, dateTo, graphInterval }: DashboardWindow) => {
  const dateTruncInterval = sql.raw(graphInterval === "hour" ? "'hour'" : "'day'");

  const result = await db.execute(sql`
      SELECT
        date_trunc(${dateTruncInterval}, "bucket_start")::timestamp AS "timestamp",
        COALESCE(SUM("total_runs"), 0)::bigint AS "run_count"
      FROM ${dashboardQueueHourlyStatsTable}
      WHERE "bucket_start" >= ${bucketFrom}
        AND "bucket_start" <= ${dateTo}
      GROUP BY 1
      ORDER BY "timestamp"
    `);

  return (result.rows as RunGraphRow[]).map((row) => ({
    timestamp: formatSqlTimestamp(row.timestamp),
    runCount: toNumber(row.run_count),
  }));
};

const getTopQueuesCount = (queuePerformance: DashboardSummary["queuePerformance"]) =>
  queuePerformance.slice(0, 20).map((row) => ({
    queue: row.queue,
    runCount: row.totalRuns,
  }));

const getTopQueuesDuration = (queuePerformance: DashboardSummary["queuePerformance"]) =>
  [...queuePerformance]
    .map((row) => ({
      queue: row.queue,
      totalDuration: row.avgDuration,
    }))
    .filter((row) => row.totalDuration > 0)
    .sort((a, b) => b.totalDuration - a.totalDuration)
    .slice(0, 20);

const fillRunGraph = (rows: DashboardSummary["runGraph"], { bucketFrom, dateTo, graphInterval }: DashboardWindow) => {
  const graphMap = new Map(rows.map((row) => [row.timestamp, row]));
  const runGraph = [];

  for (let d = new Date(bucketFrom); d <= dateTo; d = graphInterval === "hour" ? addHours(d, 1) : addDays(d, 1)) {
    const timestamp = graphInterval === "hour" ? formatSqlTimestamp(startOfHour(d)) : formatSqlTimestamp(startOfDay(d));

    runGraph.push(graphMap.get(timestamp) ?? { timestamp, runCount: 0 });
  }

  return runGraph;
};

export const getDashboardSummary = async ({ days }: { days: number }): Promise<DashboardSummary> => {
  const dashboardWindow = getDashboardWindow(days);

  const [enhancedStats, queuePerformance, runGraphRows] = await Promise.all([
    getStats(dashboardWindow),
    getQueuePerformance(dashboardWindow),
    getRunGraphRows(dashboardWindow),
  ]);

  const topQueuesCount = getTopQueuesCount(queuePerformance);
  const topQueuesDuration = getTopQueuesDuration(queuePerformance);
  const runGraph = fillRunGraph(runGraphRows, dashboardWindow);

  return {
    enhancedStats,
    queuePerformance,
    topQueuesCount,
    topQueuesDuration,
    runGraph,
  };
};
