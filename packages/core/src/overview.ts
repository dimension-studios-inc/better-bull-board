import { jobRunsTable, jobSchedulersTable, queuesTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { count, eq, sql } from "drizzle-orm";
import { z } from "zod";

export const systemOverviewSchema = z.object({
  activeJobs: z.number(),
  waitingJobs: z.number(),
  totalQueues: z.number(),
  activeQueues: z.number(),
  queuesWithSchedulers: z.number(),
});

export type SystemOverview = z.infer<typeof systemOverviewSchema>;

const toNumber = (value: number | string | null | undefined) => Number(value ?? 0);

export const getSystemOverview = async (): Promise<SystemOverview> => {
  const [activeJobsResult, waitingJobsResult, queuesResult] = await Promise.all([
    db.select({ count: count() }).from(jobRunsTable).where(eq(jobRunsTable.status, "active")),
    db.select({ count: count() }).from(jobRunsTable).where(eq(jobRunsTable.status, "waiting")),
    db.execute(sql`
      WITH scheduler_queues AS (
        SELECT DISTINCT ${jobSchedulersTable.queueId} AS queue_id
        FROM ${jobSchedulersTable}
      )
      SELECT
        COUNT(*) AS total_queues,
        COUNT(*) FILTER (WHERE NOT ${queuesTable.isPaused}) AS active_queues,
        COUNT(*) FILTER (WHERE scheduler_queues.queue_id IS NOT NULL) AS queues_with_schedulers
      FROM ${queuesTable}
      LEFT JOIN scheduler_queues ON scheduler_queues.queue_id = ${queuesTable.id}
    `),
  ]);

  const queues = queuesResult.rows[0] as
    | {
        total_queues: number | string | null;
        active_queues: number | string | null;
        queues_with_schedulers: number | string | null;
      }
    | undefined;

  return systemOverviewSchema.parse({
    activeJobs: toNumber(activeJobsResult[0]?.count),
    waitingJobs: toNumber(waitingJobsResult[0]?.count),
    totalQueues: toNumber(queues?.total_queues),
    activeQueues: toNumber(queues?.active_queues),
    queuesWithSchedulers: toNumber(queues?.queues_with_schedulers),
  });
};
