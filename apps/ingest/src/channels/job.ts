import { bulkUpsertJobRun as bulkUpsertJobRunCH } from "@better-bull-board/clickhouse";
import type { JobRunData } from "@better-bull-board/clickhouse/schemas";
import {
  jobRunsInsertSchema,
  jobRunsTable,
} from "@better-bull-board/db/schemas/job/schema";
import { db } from "@better-bull-board/db/server";
import { logger } from "@rharkor/logger";
import type { Job } from "bullmq";
import { getTableColumns, sql } from "drizzle-orm";
import type { z } from "zod/v4";
import { redis } from "~/lib/redis";

// Batching configuration
const FLUSH_SIZE = 100;
const FLUSH_INTERVAL = 200; // ms

// Buffers for batching
const jobRunBuffer: Array<{
  data: z.infer<typeof jobRunsInsertSchema>;
  dbId?: string;
}> = [];
const clickhouseBuffer: Array<{
  data: JobRunData;
  kind: "insert" | "update";
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

    // Batch upsert to PostgreSQL
    const upsertedJobs = await db
      .insert(jobRunsTable)
      .values(values)
      .onConflictDoUpdate({
        target: [jobRunsTable.jobId, jobRunsTable.enqueuedAt],
        set: {
          status: jobRunsTable.status,
          attempt: jobRunsTable.attempt,
          startedAt: jobRunsTable.startedAt,
          finishedAt: jobRunsTable.finishedAt,
          errorMessage: jobRunsTable.errorMessage,
          errorStack: jobRunsTable.errorStack,
          result: jobRunsTable.result,
          backoff: jobRunsTable.backoff,
          data: jobRunsTable.data,
          priority: jobRunsTable.priority,
          delayMs: jobRunsTable.delayMs,
          repeatJobKey: jobRunsTable.repeatJobKey,
          parentJobId: jobRunsTable.parentJobId,
          workerId: jobRunsTable.workerId,
          enqueuedAt: jobRunsTable.enqueuedAt,
          jobId: jobRunsTable.jobId,
          maxAttempts: jobRunsTable.maxAttempts,
          queue: jobRunsTable.queue,
          name: jobRunsTable.name,
          tags: jobRunsTable.tags,
        },
      })
      .returning({
        ...getTableColumns(jobRunsTable),
        inserted: sql<boolean>`(xmax = 0)`,
      });

    // Queue ClickHouse inserts and publish events
    for (const jobRun of upsertedJobs) {
      if (jobRun) {
        clickhouseBuffer.push({
          data: {
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
          },
          kind: jobRun.inserted ? "update" : "insert",
        });
      }
    }

    // Flush ClickHouse buffer if it's getting large
    if (clickhouseBuffer.length >= FLUSH_SIZE) {
      await flushClickHouseBuffer();
    }
  } catch (error) {
    logger.error("Error in batch job upsert", {
      error,
      batchSize: batch.length,
    });
    // Re-queue failed items for retry (optional)
    jobRunBuffer.unshift(...batch);
  }
}

// Batch flush function for ClickHouse
async function flushClickHouseBuffer() {
  if (clickhouseBuffer.length === 0) return;

  const batch = clickhouseBuffer.splice(0, clickhouseBuffer.length);

  try {
    // Batch insert to ClickHouse
    await bulkUpsertJobRunCH(batch);

    // Publish refresh event
    await Promise.all(
      batch.map((jobRun) =>
        redis.publish("bbb:ingest:events:job-refresh", jobRun.data.id),
      ),
    );
  } catch (error) {
    logger.error("Error in batch ClickHouse insert", {
      error,
      batchSize: batch.length,
    });
    // Re-queue failed items for retry (optional)
    clickhouseBuffer.unshift(...batch);
  }
}

// Schedule periodic flushes
function scheduleFlush() {
  if (flushTimer) {
    clearTimeout(flushTimer);
  }
  flushTimer = setTimeout(async () => {
    await flushJobRunBuffer();
    await flushClickHouseBuffer();
    if (jobRunBuffer.length > 0 || clickhouseBuffer.length > 0) {
      scheduleFlush(); // Reschedule if there are still items
    }
  }, FLUSH_INTERVAL);
}

// Queue a job run for batched processing
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
  if (
    jobRunBuffer.length >= FLUSH_SIZE * 5 ||
    clickhouseBuffer.length >= FLUSH_SIZE * 5
  ) {
    logger.warn("Job run buffer is getting large", {
      postgresBufferSize: jobRunBuffer.length,
      postgresFlushSize: FLUSH_SIZE,
      clickhouseBufferSize: clickhouseBuffer.length,
      clickhouseFlushSize: FLUSH_SIZE,
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
    };
    const validated = jobRunsInsertSchema.parse(formatted);

    // Queue for batched processing instead of individual upsert
    queueJobRun(validated);
  } catch (e) {
    logger.error("Error saving job", { error: e, message });
  }
};
