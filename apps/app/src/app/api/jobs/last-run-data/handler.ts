import { jobRunsTable } from "@better-bull-board/db";
import { desc, eq } from "drizzle-orm";
import { db } from "~/lib/db";

export const getLastRunDataHandler = async (input: {
  queueName: string;
}) => {
  const { queueName } = input;

  try {
    // Get the most recent job run for the specified queue
    const lastRun = await db
      .select({
        data: jobRunsTable.data,
        name: jobRunsTable.name,
      })
      .from(jobRunsTable)
      .where(eq(jobRunsTable.queue, queueName))
      .orderBy(desc(jobRunsTable.createdAt))
      .limit(1);

    if (lastRun.length === 0) {
      return {
        data: null,
        jobName: null,
      };
    }

    const job = lastRun[0];
    return {
      data: job.data as Record<string, unknown> | null,
      jobName: job.name,
    };
  } catch (error) {
    throw new Error(`Failed to get last run data: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
};