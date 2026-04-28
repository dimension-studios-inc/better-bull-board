import { jobLogBufferTable, jobLogsTable, jobRunsTable } from "@better-bull-board/db/schemas/job/schema";
import { db } from "@better-bull-board/db/server";
import { logger } from "@rharkor/logger";
import { and, DrizzleQueryError, eq, inArray, or, sql } from "drizzle-orm";
import { DatabaseError } from "pg";
import { acquireLock, releaseLock } from "~/lib/distributed-lock";
import { env } from "~/lib/env";
import { instanceId } from "~/lib/instance";
import { redis } from "~/lib/redis";

export type LogEventForPersistence = {
  id?: string;
  jobId: string;
  jobTimestamp: Date;
  level: "debug" | "error" | "info" | "log" | "warn";
  logSeq: number;
  logTimestamp: Date;
  message: string;
  queue: string;
};

type ResolvedLogEvent = LogEventForPersistence & {
  jobRunId: string;
};

let logBufferInterval: NodeJS.Timeout | null = null;

const getJobKey = (item: Pick<LogEventForPersistence, "jobId" | "jobTimestamp" | "queue">) =>
  `${item.queue}:${item.jobId}:${item.jobTimestamp.getTime()}`;

async function withDeadlockRetry<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (error: unknown) {
      if (error instanceof DrizzleQueryError && error.cause instanceof DatabaseError && error.cause.code === "40P01") {
        lastErr = error;
        const backoff = 25 * (i + 1) + Math.floor(Math.random() * 50);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }
      throw error;
    }
  }
  throw lastErr;
}

const resolveJobRunIds = async (events: LogEventForPersistence[]) => {
  const uniqueJobs = Array.from(new Map(events.map((event) => [getJobKey(event), event])).values());
  if (uniqueJobs.length === 0) return new Map<string, string>();

  const predicates = uniqueJobs
    .map((event) =>
      and(
        eq(jobRunsTable.queue, event.queue),
        eq(jobRunsTable.jobId, event.jobId),
        eq(jobRunsTable.enqueuedAt, event.jobTimestamp),
      ),
    )
    .filter((predicate): predicate is NonNullable<typeof predicate> => Boolean(predicate));

  if (predicates.length === 0) return new Map<string, string>();

  const rows = await db
    .select({
      id: jobRunsTable.id,
      jobId: jobRunsTable.jobId,
      queue: jobRunsTable.queue,
      enqueuedAt: jobRunsTable.enqueuedAt,
    })
    .from(jobRunsTable)
    .where(or(...predicates));

  return new Map(
    rows
      .filter((row): row is typeof row & { enqueuedAt: Date } => Boolean(row.enqueuedAt))
      .map((row) => [getJobKey({ queue: row.queue, jobId: row.jobId, jobTimestamp: row.enqueuedAt }), row.id]),
  );
};

const insertResolvedLogs = async (events: ResolvedLogEvent[]) => {
  if (events.length === 0) return;

  const byRunId = new Map<string, LogEventForPersistence[]>();
  for (const event of events) {
    const rows = byRunId.get(event.jobRunId) ?? [];
    rows.push(event);
    byRunId.set(event.jobRunId, rows);
  }

  for (const jobRunId of Array.from(byRunId.keys()).sort()) {
    const rows = byRunId.get(jobRunId) ?? [];
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      await withDeadlockRetry(async () => {
        await db
          .insert(jobLogsTable)
          .values(
            chunk.map((row) => ({
              jobRunId,
              level: row.level,
              message: row.message,
              ts: row.logTimestamp,
              logSeq: row.logSeq,
            })),
          )
          .onConflictDoNothing({
            target: [jobLogsTable.jobRunId, jobLogsTable.ts, jobLogsTable.logSeq],
          });
      });
    }
    await redis.publish("bbb:ingest:events:job-log-refresh", jobRunId);
  }
};

const bufferUnresolvedLogs = async (events: LogEventForPersistence[]) => {
  if (events.length === 0) return;

  await withDeadlockRetry(async () => {
    await db
      .insert(jobLogBufferTable)
      .values(
        events.map((event) => ({
          queue: event.queue,
          jobId: event.jobId,
          jobTimestamp: event.jobTimestamp,
          logTimestamp: event.logTimestamp,
          logSeq: event.logSeq,
          level: event.level,
          message: event.message,
        })),
      )
      .onConflictDoNothing({
        target: [
          jobLogBufferTable.queue,
          jobLogBufferTable.jobId,
          jobLogBufferTable.jobTimestamp,
          jobLogBufferTable.logTimestamp,
          jobLogBufferTable.logSeq,
        ],
      });
  });
};

export const persistLogEvents = async (events: LogEventForPersistence[]) => {
  if (events.length === 0) return [];

  const jobRunIds = await resolveJobRunIds(events);
  const resolved: ResolvedLogEvent[] = [];
  const unresolved: LogEventForPersistence[] = [];

  for (const event of events) {
    const jobRunId = jobRunIds.get(getJobKey(event));
    if (jobRunId) {
      resolved.push({ ...event, jobRunId });
    } else {
      unresolved.push(event);
    }
  }

  await insertResolvedLogs(resolved);
  await bufferUnresolvedLogs(unresolved);

  if (unresolved.length > 0) {
    logger.info("Buffered unresolved job logs", {
      resolved: resolved.length,
      unresolved: unresolved.length,
      sample: unresolved.slice(0, 5).map((event) => ({
        queue: event.queue,
        jobId: event.jobId,
        jobTimestamp: event.jobTimestamp,
        logTimestamp: event.logTimestamp,
        logSeq: event.logSeq,
      })),
    });
  }

  return events.map((event) => event.id).filter((id): id is string => Boolean(id));
};

export const resolveBufferedJobLogs = async () => {
  const bufferedRows = await db
    .select()
    .from(jobLogBufferTable)
    .orderBy(jobLogBufferTable.createdAt)
    .limit(env.JOB_LOG_BUFFER_BATCH_SIZE);

  const [{ count = 0, oldestCreatedAt = null } = { count: 0, oldestCreatedAt: null }] = await db
    .select({
      count: sql<number>`count(*)::int`,
      oldestCreatedAt: sql<Date | null>`min(${jobLogBufferTable.createdAt})`,
    })
    .from(jobLogBufferTable);

  if (bufferedRows.length === 0) return;

  const events = bufferedRows.map((row) => ({
    id: row.id,
    queue: row.queue,
    jobId: row.jobId,
    jobTimestamp: row.jobTimestamp,
    logTimestamp: row.logTimestamp,
    logSeq: row.logSeq,
    level: row.level,
    message: row.message,
  }));

  const jobRunIds = await resolveJobRunIds(events);
  const resolved = events
    .map((event) => {
      const jobRunId = jobRunIds.get(getJobKey(event));
      return jobRunId ? { ...event, jobRunId } : undefined;
    })
    .filter((event): event is ResolvedLogEvent & { id: string } => Boolean(event));

  await insertResolvedLogs(resolved);

  if (resolved.length > 0) {
    await db.delete(jobLogBufferTable).where(
      inArray(
        jobLogBufferTable.id,
        resolved.map((event) => event.id),
      ),
    );
  }

  const oldestAgeMs = oldestCreatedAt ? Date.now() - new Date(oldestCreatedAt).getTime() : 0;
  const unresolved = bufferedRows.length - resolved.length;
  const logPayload = {
    backlog: count,
    batchSize: bufferedRows.length,
    resolved: resolved.length,
    unresolved,
    oldestAgeMs,
  };

  if (oldestAgeMs >= env.JOB_LOG_BUFFER_ORPHAN_WARN_AFTER_MS) {
    logger.warn("Job log buffer contains old unresolved logs", logPayload);
  } else {
    logger.info("Resolved buffered job logs", logPayload);
  }
};

export const autoResolveBufferedJobLogs = () => {
  if (logBufferInterval) {
    clearInterval(logBufferInterval);
  }

  const run = async () => {
    const owner = `${instanceId}:${Date.now()}`;
    const lockKey = "bbb:job-log-buffer-resolver-lock";
    const acquired = await acquireLock({ key: lockKey, owner, ttlMs: env.JOB_LOG_BUFFER_FLUSH_INTERVAL_MS * 2 });
    if (!acquired) return;

    try {
      await resolveBufferedJobLogs();
    } catch (error) {
      logger.error("Error resolving buffered job logs", { error });
    } finally {
      await releaseLock({ key: lockKey, owner });
    }
  };

  logBufferInterval = setInterval(run, env.JOB_LOG_BUFFER_FLUSH_INTERVAL_MS);
  run().catch((error) => {
    logger.error("Error in initial buffered job log resolution", { error });
  });

  logger.log("📥 Job log buffer resolver started");
};

export const stopAutoResolveBufferedJobLogs = () => {
  if (!logBufferInterval) return;
  clearInterval(logBufferInterval);
  logBufferInterval = null;
  logger.log("🛑 Job log buffer resolver stopped");
};
