import { jobLogsTable } from "@better-bull-board/db/schemas/job/schema";
import { db } from "@better-bull-board/db/server";
import { logger } from "@rharkor/logger";
import { DrizzleQueryError } from "drizzle-orm";
import { DatabaseError } from "pg";
import { z } from "zod/v4";
import { redis } from "~/lib/redis";
import { getJobFromBullId } from "~/utils";

// Batching configuration
const FLUSH_INTERVAL = 200; // ms

const pendingLogSchema = z.object({
  level: z.enum(["log", "debug", "info", "warn", "error"]),
  message: z.string(),
  ts: z.date(),
  logSeq: z.number(),
  jobId: z.string(),
  queue: z.string(),
  jobTimestamp: z.number(),
});

// Buffers for batching
const logBuffer: Array<z.infer<typeof pendingLogSchema>> = [];

let logFlushTimer: NodeJS.Timeout | null = null;

async function withDeadlockRetry<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e: unknown) {
      if (e instanceof DrizzleQueryError && e.cause instanceof DatabaseError) {
        const code = e.cause.code;
        if (code !== "40P01") throw e;
        lastErr = e;
        const backoff = 25 * (i + 1) + Math.floor(Math.random() * 50);
        await new Promise((r) => setTimeout(r, backoff));
      } else {
        logger.error("Error in withDeadlockRetry", { error: e });
        throw e;
      }
    }
  }
  throw lastErr;
}

// Batch flush function for PostgreSQL logs
async function flushLogBuffer() {
  if (logBuffer.length === 0) return;
  const batch = logBuffer.splice(0, logBuffer.length);

  try {
    // Resolve jobRunId for each item (keep only valid ones)
    const withRunIds = (
      await Promise.all(
        batch.map(async (item) => {
          const { jobId, queue, jobTimestamp } = item;

          const delays = [500, 1000, 3000]; // retry delays in ms
          let jobRunId: string | undefined;

          for (let i = 0; i <= delays.length; i++) {
            jobRunId = await getJobFromBullId(jobId, new Date(jobTimestamp), queue);
            if (jobRunId) break;
            if (i < delays.length) {
              await new Promise((r) => setTimeout(r, delays[i]));
            }
          }

          if (!jobRunId) {
            logger.warn("⚠️ Received log for job that could not be found after retries", {
              jobId,
              queue,
            });
            return undefined;
          }

          return { ...item, jobRunId };
        }),
      )
    ).filter((x): x is (typeof batch)[number] & { jobRunId: string } => !!x);

    if (withRunIds.length === 0) return;

    // Group by jobRunId → each INSERT references exactly one parent row
    const groups = new Map<string, Array<(typeof withRunIds)[number]>>();
    for (const row of withRunIds) {
      const arr = groups.get(row.jobRunId) ?? [];
      arr.push(row);
      groups.set(row.jobRunId, arr);
    }

    // Deterministic order to minimize cross-transaction lock contention
    const orderedRunIds = Array.from(groups.keys()).sort();

    for (const jobRunId of orderedRunIds) {
      const rows = groups.get(jobRunId) ?? [];

      // Optional: chunk big groups (keeps statements reasonably sized)
      for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100);

        await withDeadlockRetry(async () => {
          // Insert *only* rows for this one jobRunId
          await db
            .insert(jobLogsTable)
            .values(chunk) // each has jobRunId, level, message, ts, logSeq
            .returning();

          await redis.publish("bbb:ingest:events:job-log-refresh", jobRunId);
        });
      }
    }
  } catch (error) {
    logger.error("Error in batch log insert", {
      error,
      batchSize: batch.length,
    });
    // Re-queue failed items
    logBuffer.unshift(...batch);
  }
}

// Schedule periodic flushes for logs
function scheduleLogFlush() {
  if (logFlushTimer) {
    clearTimeout(logFlushTimer);
  }
  logFlushTimer = setTimeout(async () => {
    await flushLogBuffer();
    if (logBuffer.length > 0) {
      scheduleLogFlush(); // Reschedule if there are still items
    }
  }, FLUSH_INTERVAL);
}

// Queue a log entry for batched processing
function queueLogEntry(logData: z.infer<typeof pendingLogSchema>) {
  logBuffer.push(logData);
  scheduleLogFlush();
}

export const handleLogChannel = async (_channel: string, message: string) => {
  try {
    const {
      jobId,
      message: logMessage,
      queue,
      logTimestamp,
      logSeq,
      jobTimestamp,
      level,
    } = JSON.parse(message) as {
      id: string;
      jobId: string;
      queue: string;
      logTimestamp: number;
      logSeq: number;
      jobTimestamp: number;
      message: string;
      level: string;
    };

    // Format the log data
    const formatted = {
      level: level as "log" | "debug" | "info" | "warn" | "error",
      message: logMessage,
      ts: new Date(logTimestamp),
      logSeq,
      jobId,
      queue,
      jobTimestamp,
    };

    const validated = pendingLogSchema.parse(formatted);

    // Queue for batched processing instead of individual insert
    queueLogEntry(validated);
  } catch (e) {
    logger.error("Error saving log", { error: e, message });
  }
};
