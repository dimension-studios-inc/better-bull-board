import { addDays, addHours, startOfDay, startOfHour } from "date-fns";
import { clickhouseClient } from "../lib/client";
import type { JobStats, QueueStatsWithChart } from "./schemas";

export const getJobStats = async ({
  dateFrom,
  dateTo,
}: {
  dateFrom: Date;
  dateTo: Date;
}): Promise<JobStats> => {
  const activeQuery = `
    SELECT count() as count
    FROM job_runs_ch 
    WHERE status = 'active'
  `;

  const failedQuery = `
    SELECT count() as count
    FROM job_runs_ch 
    WHERE status = 'failed' 
    AND created_at BETWEEN {date_from:DateTime64(3, 'UTC')} AND {date_to:DateTime64(3, 'UTC')}
  `;

  const completed24hQuery = `
    SELECT count() as count
    FROM job_runs_ch 
    WHERE status = 'completed' 
    AND created_at BETWEEN {date_from:DateTime64(3, 'UTC')} AND {date_to:DateTime64(3, 'UTC')}
  `;

  try {
    // Execute all queries in parallel
    const [activeResult, failedResult, completedResult] = await Promise.all([
      clickhouseClient.query({
        query: activeQuery,
        format: "JSONEachRow",
      }),
      clickhouseClient.query({
        query: failedQuery,
        query_params: { date_from: dateFrom, date_to: dateTo },
        format: "JSONEachRow",
      }),
      clickhouseClient.query({
        query: completed24hQuery,
        query_params: { date_from: dateFrom, date_to: dateTo },
        format: "JSONEachRow",
      }),
    ]);

    const [activeData, failedData, completedData] = await Promise.all([
      activeResult.json(),
      failedResult.json(),
      completedResult.json(),
    ]);

    return {
      active: Number((activeData[0] as { count: string })?.count || "0"),
      failed: Number((failedData[0] as { count: string })?.count || "0"),
      completed: Number((completedData[0] as { count: string })?.count || "0"),
    };
  } catch (error) {
    console.error("Error fetching job stats:", error);
    throw new Error("Failed to fetch job statistics");
  }
};

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
    // biome-ignore lint/suspicious/noAssignInExpressions: easier
    stepKind === "hour" ? (d = addHours(d, 1)) : (d = addDays(d, 1))
  ) {
    const ts =
      stepKind === "hour"
        ? startOfHour(d).toISOString().slice(0, 19).replace("T", " ")
        : startOfDay(d).toISOString().slice(0, 19).replace("T", " ");

    if (map.has(ts)) {
      filled.push(
        map.get(ts) as { timestamp: string; completed: number; failed: number },
      );
    } else {
      filled.push({ timestamp: ts, completed: 0, failed: 0 });
    }
  }
  return filled;
}

export const getQueueStatsWithChart = async ({
  queueNames,
  dateFrom,
  dateTo,
  timePeriod,
}: {
  queueNames: string[];
  dateFrom: Date;
  dateTo: Date;
  timePeriod: number;
}): Promise<QueueStatsWithChart[]> => {
  if (queueNames.length === 0) {
    return [];
  }

  try {
    let interval: string;
    let stepKind: string;
    if (timePeriod <= 1) {
      interval = "toStartOfHour(created_at)";
      stepKind = "hour";
    } else if (timePeriod <= 7) {
      interval = "toStartOfHour(created_at)";
      stepKind = "hour";
    } else {
      interval = "toStartOfDay(created_at)";
      stepKind = "day";
    }

    const statsPromises = queueNames.map(async (queueName) => {
      const countQuery = `
        SELECT 
          countIf(status = 'active') as active_jobs,
          countIf(status = 'failed' AND created_at BETWEEN {date_from:DateTime64(3, 'UTC')} AND {date_to:DateTime64(3, 'UTC')}) as failed_jobs,
          countIf(status = 'completed' AND created_at BETWEEN {date_from:DateTime64(3, 'UTC')} AND {date_to:DateTime64(3, 'UTC')}) as completed_jobs
        FROM job_runs_ch 
        WHERE queue = {queue:String}
      `;

      const chartQuery = `
        SELECT 
          ${interval} as timestamp,
          countIf(status = 'completed') as completed,
          countIf(status = 'failed') as failed
        FROM job_runs_ch 
        WHERE queue = {queue:String}
          AND created_at BETWEEN {date_from:DateTime64(3, 'UTC')} AND {date_to:DateTime64(3, 'UTC')}
        GROUP BY timestamp
        ORDER BY timestamp
      `;

      const [countResult, chartResult] = await Promise.all([
        clickhouseClient.query({
          query: countQuery,
          query_params: {
            queue: queueName,
            date_from: dateFrom,
            date_to: dateTo,
          },
          format: "JSONEachRow",
        }),
        clickhouseClient.query({
          query: chartQuery,
          query_params: {
            queue: queueName,
            date_from: dateFrom,
            date_to: dateTo,
          },
          format: "JSONEachRow",
        }),
      ]);

      const [countData, chartDataRaw] = await Promise.all([
        countResult.json(),
        chartResult.json(),
      ]);

      const counts =
        (countData[0] as {
          active_jobs: string;
          failed_jobs: string;
          completed_jobs: string;
        }) ||
        ({ active_jobs: "0", failed_jobs: "0", completed_jobs: "0" } as const);

      const chartData = (
        chartDataRaw as {
          timestamp: string;
          completed: string;
          failed: string;
        }[]
      ).map((item) => ({
        timestamp: item.timestamp,
        completed: Number(item.completed),
        failed: Number(item.failed),
      }));

      return {
        queueName,
        activeJobs: Number(counts.active_jobs),
        failedJobs: Number(counts.failed_jobs),
        completedJobs: Number(counts.completed_jobs),
        chartData: fillChartData(dateFrom, dateTo, stepKind, chartData),
      };
    });

    return await Promise.all(statsPromises);
  } catch (error) {
    console.error("Error fetching queue stats with chart:", error);
    throw new Error("Failed to fetch queue statistics with chart data");
  }
};
