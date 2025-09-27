import { upsertJobRun as upsertJobRunCH } from "@better-bull-board/clickhouse";
import {
  jobRunsInsertSchema,
  jobRunsTable,
} from "@better-bull-board/db/schemas/job/schema";
import { db } from "@better-bull-board/db/server";
import { logger } from "@rharkor/logger";
import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import type { z } from "zod/v4";
import { redis } from "~/lib/redis";
import { redlock } from "~/lib/redlock";
import { getJobFromBullId } from "~/utils";

export const handleJobChannel = async (_channel: string, message: string) => {
  try {
    const {
      id,
      job,
      tags,
      queueName: queue,
    } = JSON.parse(message) as {
      id: string;
      job: ReturnType<Job["toJSON"]>;
      tags?: string[];
      queueName: string;
    };
    if (!job.id) {
      throw new Error("Job ID is required");
    }
    const formatted: z.infer<typeof jobRunsInsertSchema> = {
      workerId: id,
      jobId: job.id,
      queue,
      status: job.finishedOn
        ? job.failedReason
          ? "failed"
          : "completed"
        : "active",
      attempt: job.attemptsMade,
      maxAttempts: job.opts.attempts,
      priority: job.opts.priority,
      delayMs: job.opts.delay,
      backoff: job.opts.backoff,
      data: job.data,
      enqueuedAt: new Date(job.timestamp),
      startedAt: job.processedOn ? new Date(job.processedOn) : undefined,
      finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
      errorMessage: job.failedReason,
      errorStack: job.stacktrace.join("\n"),
      name: job.name,
      parentJobId: job.opts.parent?.id,
      repeatJobKey: job.repeatJobKey,
      result: job.returnvalue,
      tags,
    };
    const validated = jobRunsInsertSchema.parse(formatted);
    let dbId: string | undefined;
    await redlock.using(
      [`bbb:job-run:upsert:${validated.jobId}`],
      1_000,
      async (signal) => {
        signal.throwIfAborted();
        const jobRun = await upsertJobRun(validated);
        dbId = jobRun.id;
        await upsertJobRunCH({
          ...jobRun,
          job_id: jobRun.jobId,
          max_attempts: jobRun.maxAttempts,
          delay_ms: jobRun.delayMs,
          repeat_job_key: jobRun.repeatJobKey,
          parent_job_id: jobRun.parentJobId,
          worker_id: jobRun.workerId,
          error_message: jobRun.errorMessage,
          error_stack: jobRun.errorStack,
          created_at: jobRun.createdAt,
          enqueued_at: jobRun.enqueuedAt,
          started_at: jobRun.startedAt,
          finished_at: jobRun.finishedAt,
        });
      },
    );
    dbId && redis.publish("bbb:ingest:events:job-refresh", dbId);
  } catch (e) {
    logger.error("Error saving job", { error: e, message });
  }
};

const upsertJobRun = async (validated: z.infer<typeof jobRunsInsertSchema>) => {
  const existingJobRun = await getJobFromBullId(
    validated.jobId,
    validated.enqueuedAt as Date,
  );
  const [jobRun] = existingJobRun
    ? await db
        .update(jobRunsTable)
        .set(validated)
        .where(eq(jobRunsTable.id, existingJobRun))
        .returning()
    : await db.insert(jobRunsTable).values(validated).returning();
  if (!jobRun) {
    throw new Error("Failed to insert job run into database");
  }
  return jobRun;
};
