import {
  jobRunsInsertSchema,
  jobRunsTable,
} from "@better-bull-board/db/schemas/job/schema";
import { db } from "@better-bull-board/db/server";
import { conflictUpdateSet } from "@better-bull-board/db/utils/conflict-update";
import { logger } from "@rharkor/logger";
import type { Job } from "bullmq";
import type { z } from "zod/v4";

// Batching configuration
const FLUSH_SIZE = 300;
const FLUSH_INTERVAL = 200; // ms

// Buffers for batching
const jobRunBuffer: Array<{
  data: z.infer<typeof jobRunsInsertSchema>;
  dbId?: string;
}> = [];

let flushTimer: NodeJS.Timeout | null = null;

// Batch flush function for PostgreSQL
// Batch flush function for PostgreSQL
async function flushJobRunBuffer() {
  if (jobRunBuffer.length === 0) return;

  // Take everything currently in the buffer
  const batch = jobRunBuffer.splice(0, jobRunBuffer.length);

  try {
    // Deduplicate on (jobId, enqueuedAt) so Postgres never updates the same row twice
    const deduped = new Map<string, (typeof batch)[0]>();
    for (const item of batch) {
      const key = `${item.data.jobId}-${item.data.enqueuedAt?.getTime?.() ?? item.data.enqueuedAt}`;
      deduped.set(key, item); // later item wins
    }
    const values = Array.from(deduped.values()).map((item) => item.data);
    values.sort((a, b) => {
      const byJob = a.jobId.localeCompare(b.jobId);
      if (byJob !== 0) return byJob;
      const ae = a.enqueuedAt ? new Date(a.enqueuedAt).getTime() : 0;
      const be = b.enqueuedAt ? new Date(b.enqueuedAt).getTime() : 0;
      return ae - be;
    });

    // Batch upsert to PostgreSQL
    await db
      .insert(jobRunsTable)
      .values(values)
      .onConflictDoUpdate({
        target: [jobRunsTable.jobId, jobRunsTable.enqueuedAt],
        // Voluntarily not updating the createdAt
        set: conflictUpdateSet(jobRunsTable, [
          "status",
          "attempt",
          "startedAt",
          "finishedAt",
          "errorMessage",
          "errorStack",
          "result",
          "backoff",
          "data",
          "priority",
          "delayMs",
          "repeatJobKey",
          "parentJobId",
          "workerId",
          "enqueuedAt",
          "jobId",
          "maxAttempts",
          "queue",
          "name",
          "tags",
        ]),
      })
      .returning({
        id: jobRunsTable.id,
        createdAt: jobRunsTable.createdAt,
      });
  } catch (error) {
    logger.error("Error in batch job upsert", {
      error,
      batchSize: batch.length,
    });
    // Re-queue failed items for retry (optional)
    jobRunBuffer.unshift(...batch);
  }
}

// Schedule periodic flushes
function scheduleFlush() {
  if (flushTimer) {
    clearTimeout(flushTimer);
  }
  flushTimer = setTimeout(async () => {
    await flushJobRunBuffer();
    if (jobRunBuffer.length > 0) {
      scheduleFlush(); // Reschedule if there are still items
    }
  }, FLUSH_INTERVAL);
}

// Queue a job run for batched processing
let throwToLargeAlert = false;
function queueJobRun(jobData: z.infer<typeof jobRunsInsertSchema>) {
  jobRunBuffer.push({ data: jobData });

  // Flush immediately if buffer is full
  if (jobRunBuffer.length >= FLUSH_SIZE) {
    setTimeout(flushJobRunBuffer, 0);
  } else {
    // Schedule a flush if not already scheduled
    scheduleFlush();
  }

  // Log a warning if the buffer is getting large
  if (jobRunBuffer.length >= FLUSH_SIZE * 5) {
    throwToLargeAlert = true;
    logger.warn("Job run buffer is getting large", {
      postgresBufferSize: jobRunBuffer.length,
    });
  } else if (throwToLargeAlert) {
    throwToLargeAlert = false;
    logger.success("Job run buffer is back to normal", {
      postgresBufferSize: jobRunBuffer.length,
    });
  }
}

export const handleJobChannel = async (_channel: string, message: string) => {
  try {
    const {
      id,
      job,
      isWaiting,
      tags,
      queueName: queue,
    } = JSON.parse(message) as {
      id: string;
      job: ReturnType<Job["toJSON"]>;
      isWaiting?: boolean;
      tags?: string[];
      queueName: string;
    };
    if (!job.id) {
      throw new Error("Job ID is required");
    }
    if (queue === "{test-log}") {
      console.log({ message });
    }
    const status = job.finishedOn
      ? job.failedReason
        ? "failed"
        : "completed"
      : isWaiting
        ? "waiting"
        : "active";
    const formatted: z.infer<typeof jobRunsInsertSchema> = {
      workerId: id,
      jobId: job.id,
      queue,
      status,
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
      createdAt: new Date(), // We need to set the createdAt to the current date manually to check abbove if update or insert
    };
    const validated = jobRunsInsertSchema.parse(formatted);

    // Queue for batched processing instead of individual upsert
    queueJobRun(validated);
  } catch (e) {
    logger.error("Error saving job", { error: e, message });
  }
};
