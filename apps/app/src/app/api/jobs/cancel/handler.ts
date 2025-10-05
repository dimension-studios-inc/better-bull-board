import { cancelJob } from "@better-bull-board/client/lib/cancellation";
import { jobRunsTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { eq } from "drizzle-orm";
import { redis } from "~/lib/redis";

export const cancelJobHandler = async (input: {
  jobId: string;
  queueName: string;
}) => {
  const { jobId, queueName } = input;

  await cancelJob({
    redis,
    jobId,
    queueName,
  });

  //* Sometimes the job doesnt exist anymore in redis so we need to ensure that it was really cancelled
  // Postgres

  await db.transaction(async (tx) => {
    const [pgjob] = await tx
      .select()
      .from(jobRunsTable)
      .where(eq(jobRunsTable.jobId, jobId))
      .limit(1);
    if (!pgjob) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (pgjob.status !== "completed" && pgjob.status !== "failed") {
      const [updated] = await tx
        .update(jobRunsTable)
        .set({
          status: "failed",
          errorMessage: "Job cancelled",
        })
        .where(eq(jobRunsTable.jobId, jobId))
        .returning();

      if (!updated) {
        throw new Error(`Updated job ${jobId} not found`);
      }
    }
  });

  return {
    success: true,
    message: `Job ${jobId} has been cancelled successfully`,
  };
};
