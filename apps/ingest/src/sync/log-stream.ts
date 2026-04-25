import { jobLogsTable } from "@better-bull-board/db/schemas/job/schema";
import { db } from "@better-bull-board/db/server";
import { logger } from "@rharkor/logger";
import { DrizzleQueryError } from "drizzle-orm";
import { DatabaseError } from "pg";
import { z } from "zod/v4";
import { env } from "~/lib/env";
import { instanceId } from "~/lib/instance";
import { redis } from "~/lib/redis";
import { getJobFromBullId } from "~/utils";

type StreamMessage = {
  id: string;
  fields: string[];
};

const logSyncEventSchema = z.object({
  version: z.literal(1),
  workerId: z.string(),
  queueName: z.string(),
  jobId: z.string(),
  jobTimestamp: z.number(),
  logTimestamp: z.number(),
  logSeq: z.number(),
  level: z.enum(["log", "debug", "info", "warn", "error"]),
  message: z.string(),
});

type LogSyncEvent = z.infer<typeof logSyncEventSchema>;

const getField = (fields: string[], key: string) => {
  const index = fields.indexOf(key);
  return index === -1 ? undefined : fields[index + 1];
};

const parseReadGroupResponse = (response: unknown): StreamMessage[] => {
  if (!Array.isArray(response)) return [];
  const messages: StreamMessage[] = [];
  for (const stream of response) {
    if (!Array.isArray(stream) || !Array.isArray(stream[1])) continue;
    for (const message of stream[1]) {
      if (!Array.isArray(message) || typeof message[0] !== "string" || !Array.isArray(message[1])) continue;
      messages.push({ id: message[0], fields: message[1].map(String) });
    }
  }
  return messages;
};

const parseAutoClaimResponse = (response: unknown): StreamMessage[] => {
  if (!Array.isArray(response) || !Array.isArray(response[1])) return [];
  return response[1]
    .map((message): StreamMessage | undefined => {
      if (!Array.isArray(message) || typeof message[0] !== "string" || !Array.isArray(message[1])) return undefined;
      return { id: message[0], fields: message[1].map(String) };
    })
    .filter((message): message is StreamMessage => Boolean(message));
};

const parseLogSyncEvent = (payload: string): LogSyncEvent => logSyncEventSchema.parse(JSON.parse(payload));

const ensureGroup = async () => {
  try {
    await redis.call("XGROUP", "CREATE", env.JOB_LOG_SYNC_STREAM_KEY, env.JOB_LOG_SYNC_CONSUMER_GROUP, "0", "MKSTREAM");
  } catch (error) {
    if (error instanceof Error && error.message.includes("BUSYGROUP")) return;
    throw error;
  }
};

const ackAndDelete = async (ids: string[]) => {
  if (ids.length === 0) return;
  await redis.call("XACK", env.JOB_LOG_SYNC_STREAM_KEY, env.JOB_LOG_SYNC_CONSUMER_GROUP, ...ids);
  await redis.call("XDEL", env.JOB_LOG_SYNC_STREAM_KEY, ...ids);
};

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

const insertLogs = async (events: Array<{ event: LogSyncEvent; id: string }>) => {
  const byRunId = new Map<
    string,
    Array<{
      level: LogSyncEvent["level"];
      logSeq: number;
      message: string;
      ts: Date;
    }>
  >();
  const resolvedIds: string[] = [];
  const unresolvedIds: string[] = [];

  for (const item of events) {
    const jobRunId = await getJobFromBullId(item.event.jobId, new Date(item.event.jobTimestamp), item.event.queueName);
    if (!jobRunId) {
      unresolvedIds.push(item.id);
      continue;
    }

    const rows = byRunId.get(jobRunId) ?? [];
    rows.push({
      level: item.event.level,
      message: item.event.message,
      ts: new Date(item.event.logTimestamp),
      logSeq: item.event.logSeq,
    });
    byRunId.set(jobRunId, rows);
    resolvedIds.push(item.id);
  }

  for (const jobRunId of Array.from(byRunId.keys()).sort()) {
    const rows = byRunId.get(jobRunId) ?? [];
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      await withDeadlockRetry(async () => {
        await db
          .insert(jobLogsTable)
          .values(chunk.map((row) => ({ ...row, jobRunId })))
          .onConflictDoNothing({
            target: [jobLogsTable.jobRunId, jobLogsTable.ts, jobLogsTable.logSeq],
          });
      });
    }
    await redis.publish("bbb:ingest:events:job-log-refresh", jobRunId);
  }

  if (unresolvedIds.length > 0) {
    logger.debug("Leaving job log stream messages pending until parent job row exists", {
      count: unresolvedIds.length,
      sample: unresolvedIds.slice(0, 5),
    });
  }

  return resolvedIds;
};

const processMessages = async (messages: StreamMessage[]) => {
  if (messages.length === 0) return;

  const valid: Array<{ event: LogSyncEvent; id: string }> = [];
  const invalidIds: string[] = [];

  for (const message of messages) {
    const payload = getField(message.fields, "payload");
    if (!payload) {
      invalidIds.push(message.id);
      logger.warn("Job log stream message missing payload", { messageId: message.id });
      continue;
    }

    try {
      valid.push({
        id: message.id,
        event: parseLogSyncEvent(payload),
      });
    } catch (error) {
      invalidIds.push(message.id);
      logger.error("Invalid job log stream payload", { error, messageId: message.id });
    }
  }

  if (invalidIds.length > 0) {
    await ackAndDelete(invalidIds);
  }

  if (valid.length === 0) return;
  const insertedIds = await insertLogs(valid);
  await ackAndDelete(insertedIds);
};

const readPendingMessages = async () => {
  try {
    const response = await redis.call(
      "XAUTOCLAIM",
      env.JOB_LOG_SYNC_STREAM_KEY,
      env.JOB_LOG_SYNC_CONSUMER_GROUP,
      instanceId,
      env.JOB_LOG_SYNC_PENDING_IDLE_MS,
      "0-0",
      "COUNT",
      env.JOB_LOG_SYNC_BATCH_SIZE,
    );
    return parseAutoClaimResponse(response);
  } catch (error) {
    logger.warn("Unable to reclaim pending job log sync messages", { error });
    return [];
  }
};

const readNewMessages = async () => {
  const response = await redis.call(
    "XREADGROUP",
    "GROUP",
    env.JOB_LOG_SYNC_CONSUMER_GROUP,
    instanceId,
    "COUNT",
    env.JOB_LOG_SYNC_BATCH_SIZE,
    "BLOCK",
    5000,
    "STREAMS",
    env.JOB_LOG_SYNC_STREAM_KEY,
    ">",
  );
  return parseReadGroupResponse(response);
};

export const startJobLogStreamIngestion = async () => {
  await ensureGroup();
  logger.log("📥 Job log stream ingestion started", {
    stream: env.JOB_LOG_SYNC_STREAM_KEY,
    group: env.JOB_LOG_SYNC_CONSUMER_GROUP,
    consumer: instanceId,
  });

  const loop = async () => {
    while (true) {
      try {
        const pendingMessages = await readPendingMessages();
        if (pendingMessages.length > 0) {
          await processMessages(pendingMessages);
          continue;
        }

        const messages = await readNewMessages();
        await processMessages(messages);
      } catch (error) {
        logger.error("Job log stream ingestion loop failed", { error });
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  };

  void loop();
};
