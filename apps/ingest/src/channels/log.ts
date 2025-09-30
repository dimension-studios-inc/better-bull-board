import { insertJobLog as insertJobLogCH } from "@better-bull-board/clickhouse";
import {
  jobLogsInsertSchema,
  jobLogsTable,
} from "@better-bull-board/db/schemas/job/schema";
import { db } from "@better-bull-board/db/server";
import { logger } from "@rharkor/logger";
import type { z } from "zod/v4";
import { redis } from "~/lib/redis";
import { getJobFromBullId } from "~/utils";

// Batching configuration
const FLUSH_SIZE = 100;
const FLUSH_INTERVAL = 200; // ms

// Buffers for batching
const logBuffer: Array<{
  data: z.infer<typeof jobLogsInsertSchema>;
  jobRunId: string;
}> = [];
const clickhouseLogBuffer: Array<any> = [];

let logFlushTimer: NodeJS.Timeout | null = null;

// Batch flush function for PostgreSQL logs
async function flushLogBuffer() {
  if (logBuffer.length === 0) return;

  const batch = logBuffer.splice(0, logBuffer.length);
  const startTime = performance.now();

  try {
    // Batch insert to PostgreSQL (logs are append-only, no conflicts)
    const insertedLogs = await db
      .insert(jobLogsTable)
      .values(batch.map(item => item.data))
      .returning();

    const endTime = performance.now();
    console.log(`Batch insert PostgreSQL logs (${batch.length} logs): ${endTime - startTime}ms`);

    // Queue ClickHouse inserts and publish events
    for (let i = 0; i < insertedLogs.length; i++) {
      const insertedLog = insertedLogs[i];
      const originalItem = batch[i];
      
      if (insertedLog && originalItem) {
        // Add to ClickHouse buffer
        clickhouseLogBuffer.push({
          ...insertedLog,
          job_run_id: insertedLog.jobRunId,
          log_seq: insertedLog.logSeq,
        });

        // Publish refresh events
        redis.publish("bbb:ingest:events:job-refresh", originalItem.jobRunId);
        redis.publish("bbb:ingest:events:log-refresh", originalItem.jobRunId);
      }
    }

    // Flush ClickHouse buffer if it's getting large
    if (clickhouseLogBuffer.length >= FLUSH_SIZE) {
      await flushClickHouseLogBuffer();
    }
  } catch (error) {
    logger.error("Error in batch log insert", { error, batchSize: batch.length });
    // Re-queue failed items for retry (optional)
    logBuffer.unshift(...batch);
  }
}

// Batch flush function for ClickHouse logs
async function flushClickHouseLogBuffer() {
  if (clickhouseLogBuffer.length === 0) return;

  const batch = clickhouseLogBuffer.splice(0, clickhouseLogBuffer.length);
  const startTime = performance.now();

  try {
    // Batch insert to ClickHouse
    await Promise.all(batch.map(logEntry => insertJobLogCH(logEntry)));
    
    const endTime = performance.now();
    console.log(`Batch insert ClickHouse logs (${batch.length} logs): ${endTime - startTime}ms`);
  } catch (error) {
    logger.error("Error in batch ClickHouse log insert", { error, batchSize: batch.length });
    // Re-queue failed items for retry (optional)
    clickhouseLogBuffer.unshift(...batch);
  }
}

// Schedule periodic flushes for logs
function scheduleLogFlush() {
  if (logFlushTimer) {
    clearTimeout(logFlushTimer);
  }
  logFlushTimer = setTimeout(async () => {
    await flushLogBuffer();
    await flushClickHouseLogBuffer();
    if (logBuffer.length > 0 || clickhouseLogBuffer.length > 0) {
      scheduleLogFlush(); // Reschedule if there are still items
    }
  }, FLUSH_INTERVAL);
}

// Queue a log entry for batched processing
function queueLogEntry(logData: z.infer<typeof jobLogsInsertSchema>, jobRunId: string) {
  logBuffer.push({ data: logData, jobRunId });
  
  // Flush immediately if buffer is full
  if (logBuffer.length >= FLUSH_SIZE) {
    setTimeout(flushLogBuffer, 0);
  } else {
    // Schedule a flush if not already scheduled
    scheduleLogFlush();
  }
}

export const handleLogChannel = async (_channel: string, message: string) => {
  try {
    const {
      jobId,
      message: logMessage,
      logTimestamp,
      logSeq,
      jobTimestamp,
      level,
    } = JSON.parse(message) as {
      id: string;
      jobId: string;
      logTimestamp: number;
      logSeq: number;
      jobTimestamp: number;
      message: string;
      level: string;
    };
    let jobRunId = await getJobFromBullId(jobId, new Date(jobTimestamp));
    if (!jobRunId) {
      // Retry in 1 second
      await new Promise((resolve) => setTimeout(resolve, 1000));
      jobRunId = await getJobFromBullId(jobId, new Date(jobTimestamp));
      if (!jobRunId) {
        logger.warn("No job run found for job ID", { jobId });
        return;
      }
    }

    // Format the log data
    const formatted: z.infer<typeof jobLogsInsertSchema> = {
      jobRunId,
      level: level as "log" | "debug" | "info" | "warn" | "error",
      message: logMessage,
      ts: new Date(logTimestamp),
      logSeq,
    };

    const validated = jobLogsInsertSchema.parse(formatted);

    // Queue for batched processing instead of individual insert
    queueLogEntry(validated, jobRunId);
  } catch (e) {
    logger.error("Error saving log", { error: e, message });
  }
};
