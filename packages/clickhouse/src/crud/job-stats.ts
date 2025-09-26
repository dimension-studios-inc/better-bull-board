import { clickhouseClient } from "../lib/client";
import type { JobStats } from "./schemas";

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
