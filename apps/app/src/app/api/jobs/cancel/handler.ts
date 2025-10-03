import { cancelJobRun } from "@better-bull-board/clickhouse";
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

      // Clickhouse
      await cancelJobRun({
        ...updated,
        status: updated.status,
        data: updated.data ?? null,
        result: updated.result ?? null,
        name: updated.name ?? null,
        attempt: updated.attempt ?? 0,
        priority: updated.priority ?? null,
        backoff: updated.backoff ?? null,
        job_id: updated.jobId,
        tags: updated.tags ?? null,
        max_attempts: updated.maxAttempts ?? 1,
        delay_ms: updated.delayMs ?? 0,
        repeat_job_key: updated.repeatJobKey ?? null,
        parent_job_id: updated.parentJobId ?? null,
        worker_id: updated.workerId ?? null,
        error_message: updated.errorMessage ?? null,
        error_stack: updated.errorStack ?? null,
        created_at: updated.createdAt, // Keep the value from the database
        enqueued_at: updated.enqueuedAt ?? null,
        started_at: updated.startedAt ?? null,
        finished_at: updated.finishedAt ?? null,
      });
    }
  });

  return {
    success: true,
    message: `Job ${jobId} has been cancelled successfully`,
  };
};
