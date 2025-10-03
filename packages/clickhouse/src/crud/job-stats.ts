import { addDays, addHours, startOfDay, startOfHour } from "date-fns";
import { clickhouseClient } from "../lib/client";
import type { JobStats, QueueStatsWithChart } from "./schemas";

export interface EnhancedJobStats {
  runningTasks: number;
  waitingInQueue: number;
  successes: number;
  failures: number;
}

export interface QueuePerformanceData {
  queue: string;
  totalRuns: number;
  successes: number;
  failures: number;
  errorRate: number;
  avgDuration: number;
}

export interface QueueDurationData {
  queue: string;
  totalDuration: number;
}

export interface QueueCountData {
  queue: string;
  runCount: number;
}

export interface RunGraphData {
  timestamp: string;
  runCount: number;
}

export const getJobStats = async ({
  dateFrom,
  dateTo,
}: {
  dateFrom: Date;
  dateTo: Date;
}): Promise<JobStats> => {
  const activeQuery = `
    SELECT count() as count
    FROM job_runs_ch FINAL
    WHERE status = 'active'
  `;

  const failedQuery = `
    SELECT count() as count
    FROM job_runs_ch FINAL 
    WHERE status = 'failed' 
    AND created_at BETWEEN {date_from:DateTime64(3, 'UTC')} AND {date_to:DateTime64(3, 'UTC')}
  `;

  const completed24hQuery = `
    SELECT count() as count
    FROM job_runs_ch FINAL
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
          countIf(status = 'waiting') as waiting_jobs,
          countIf(status = 'active') as active_jobs,
          countIf(status = 'failed' AND created_at BETWEEN {date_from:DateTime64(3, 'UTC')} AND {date_to:DateTime64(3, 'UTC')}) as failed_jobs,
          countIf(status = 'completed' AND created_at BETWEEN {date_from:DateTime64(3, 'UTC')} AND {date_to:DateTime64(3, 'UTC')}) as completed_jobs
        FROM job_runs_ch FINAL
        WHERE queue = {queue:String}
      `;

      const chartQuery = `
        SELECT 
          ${interval} as timestamp,
          countIf(status = 'completed') as completed,
          countIf(status = 'failed') as failed
        FROM job_runs_ch FINAL
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
          waiting_jobs: string;
          active_jobs: string;
          failed_jobs: string;
          completed_jobs: string;
        }) ||
        ({
          waiting_jobs: "0",
          active_jobs: "0",
          failed_jobs: "0",
          completed_jobs: "0",
        } as const);

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
        waitingJobs: Number(counts.waiting_jobs),
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

export const getEnhancedJobStats = async ({
  dateFrom,
  dateTo,
}: {
  dateFrom: Date;
  dateTo: Date;
}): Promise<EnhancedJobStats> => {
  const runningTasksQuery = `
    SELECT count() as count
    FROM job_runs_ch FINAL
    WHERE status = 'active'
  `;

  const waitingInQueueQuery = `
    SELECT count() as count
    FROM job_runs_ch FINAL
    WHERE status = 'waiting'
  `;

  const successesQuery = `
    SELECT count() as count
    FROM job_runs_ch FINAL
    WHERE status = 'completed' 
    AND created_at BETWEEN {date_from:DateTime64(3, 'UTC')} AND {date_to:DateTime64(3, 'UTC')}
  `;

  const failuresQuery = `
    SELECT count() as count
    FROM job_runs_ch FINAL
    WHERE status = 'failed' 
    AND created_at BETWEEN {date_from:DateTime64(3, 'UTC')} AND {date_to:DateTime64(3, 'UTC')}
  `;

  try {
    const [runningResult, waitingResult, successResult, failureResult] =
      await Promise.all([
        clickhouseClient.query({
          query: runningTasksQuery,
          format: "JSONEachRow",
        }),
        clickhouseClient.query({
          query: waitingInQueueQuery,
          format: "JSONEachRow",
        }),
        clickhouseClient.query({
          query: successesQuery,
          query_params: { date_from: dateFrom, date_to: dateTo },
          format: "JSONEachRow",
        }),
        clickhouseClient.query({
          query: failuresQuery,
          query_params: { date_from: dateFrom, date_to: dateTo },
          format: "JSONEachRow",
        }),
      ]);

    const [runningData, waitingData, successData, failureData] =
      await Promise.all([
        runningResult.json(),
        waitingResult.json(),
        successResult.json(),
        failureResult.json(),
      ]);

    return {
      runningTasks: Number((runningData[0] as { count: string })?.count || "0"),
      waitingInQueue: Number(
        (waitingData[0] as { count: string })?.count || "0",
      ),
      successes: Number((successData[0] as { count: string })?.count || "0"),
      failures: Number((failureData[0] as { count: string })?.count || "0"),
    };
  } catch (error) {
    console.error("Error fetching enhanced job stats:", error);
    throw new Error("Failed to fetch enhanced job statistics");
  }
};

export const getQueuePerformanceData = async ({
  dateFrom,
  dateTo,
}: {
  dateFrom: Date;
  dateTo: Date;
}): Promise<QueuePerformanceData[]> => {
  const query = `
    SELECT 
      queue,
      count() as total_runs,
      countIf(status = 'completed') as successes,
      countIf(status = 'failed') as failures,
      avgIf(
        finished_at - started_at,
        status = 'completed' AND started_at IS NOT NULL AND finished_at IS NOT NULL
      ) as avg_duration_seconds
    FROM job_runs_ch FINAL
    WHERE created_at BETWEEN {date_from:DateTime64(3, 'UTC')} AND {date_to:DateTime64(3, 'UTC')}
    GROUP BY queue
    ORDER BY total_runs DESC
  `;

  try {
    const result = await clickhouseClient.query({
      query,
      query_params: { date_from: dateFrom, date_to: dateTo },
      format: "JSONEachRow",
    });

    const data = (await result.json()) as {
      queue: string;
      total_runs: string;
      successes: string;
      failures: string;
      avg_duration_seconds: string;
    }[];

    return data.map((item) => {
      const totalRuns = Number(item.total_runs);
      const successes = Number(item.successes);
      const failures = Number(item.failures);
      return {
        queue: item.queue,
        totalRuns,
        successes,
        failures,
        errorRate: totalRuns > 0 ? (failures / totalRuns) * 100 : 0,
        avgDuration: Number(item.avg_duration_seconds) || 0,
      };
    });
  } catch (error) {
    console.error("Error fetching queue performance data:", error);
    throw new Error("Failed to fetch queue performance data");
  }
};

export const getTopQueuesByDuration = async ({
  dateFrom,
  dateTo,
  limit = 10,
}: {
  dateFrom: Date;
  dateTo: Date;
  limit?: number;
}): Promise<QueueDurationData[]> => {
  const query = `
    SELECT 
      queue,
      sumIf(
        finished_at - started_at,
        status = 'completed' AND started_at IS NOT NULL AND finished_at IS NOT NULL
      ) as total_duration_seconds
    FROM job_runs_ch FINAL
    WHERE created_at BETWEEN {date_from:DateTime64(3, 'UTC')} AND {date_to:DateTime64(3, 'UTC')}
    GROUP BY queue
    HAVING total_duration_seconds > 0
    ORDER BY total_duration_seconds DESC
    LIMIT {limit:UInt32}
  `;

  try {
    const result = await clickhouseClient.query({
      query,
      query_params: { date_from: dateFrom, date_to: dateTo, limit },
      format: "JSONEachRow",
    });

    const data = (await result.json()) as {
      queue: string;
      total_duration_seconds: string;
    }[];

    return data.map((item) => ({
      queue: item.queue,
      totalDuration: Number(item.total_duration_seconds),
    }));
  } catch (error) {
    console.error("Error fetching top queues by duration:", error);
    throw new Error("Failed to fetch top queues by duration");
  }
};

export const getTopQueuesByRunCount = async ({
  dateFrom,
  dateTo,
  limit = 10,
}: {
  dateFrom: Date;
  dateTo: Date;
  limit?: number;
}): Promise<QueueCountData[]> => {
  const query = `
    SELECT 
      queue,
      count() as run_count
    FROM job_runs_ch FINAL
    WHERE created_at BETWEEN {date_from:DateTime64(3, 'UTC')} AND {date_to:DateTime64(3, 'UTC')}
    GROUP BY queue
    ORDER BY run_count DESC
    LIMIT {limit:UInt32}
  `;

  try {
    const result = await clickhouseClient.query({
      query,
      query_params: { date_from: dateFrom, date_to: dateTo, limit },
      format: "JSONEachRow",
    });

    const data = (await result.json()) as {
      queue: string;
      run_count: string;
    }[];

    return data.map((item) => ({
      queue: item.queue,
      runCount: Number(item.run_count),
    }));
  } catch (error) {
    console.error("Error fetching top queues by run count:", error);
    throw new Error("Failed to fetch top queues by run count");
  }
};

export const getRunGraphData = async ({
  dateFrom,
  dateTo,
  timePeriod,
}: {
  dateFrom: Date;
  dateTo: Date;
  timePeriod: number;
}): Promise<RunGraphData[]> => {
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

  const query = `
    SELECT 
      ${interval} as timestamp,
      count() as run_count
    FROM job_runs_ch FINAL
    WHERE created_at BETWEEN {date_from:DateTime64(3, 'UTC')} AND {date_to:DateTime64(3, 'UTC')}
    GROUP BY timestamp
    ORDER BY timestamp
  `;

  try {
    const result = await clickhouseClient.query({
      query,
      query_params: { date_from: dateFrom, date_to: dateTo },
      format: "JSONEachRow",
    });

    const data = (await result.json()) as {
      timestamp: string;
      run_count: string;
    }[];

    const chartData = data.map((item) => ({
      timestamp: item.timestamp,
      runCount: Number(item.run_count),
    }));

    return fillRunGraphData(dateFrom, dateTo, stepKind, chartData);
  } catch (error) {
    console.error("Error fetching run graph data:", error);
    throw new Error("Failed to fetch run graph data");
  }
};

function fillRunGraphData(
  dateFrom: Date,
  dateTo: Date,
  stepKind: string,
  chartData: { timestamp: string; runCount: number }[],
): RunGraphData[] {
  const filled: RunGraphData[] = [];
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
      filled.push(map.get(ts) as { timestamp: string; runCount: number });
    } else {
      filled.push({ timestamp: ts, runCount: 0 });
    }
  }
  return filled;
}
