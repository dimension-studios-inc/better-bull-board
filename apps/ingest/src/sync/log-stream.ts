import { logger } from "@rharkor/logger";
import { z } from "zod/v4";
import { env } from "~/lib/env";
import { instanceId } from "~/lib/instance";
import { redis } from "~/lib/redis";
import { persistLogEvents } from "~/sync/log-buffer";

const streamRedis = redis.duplicate();

streamRedis.on("error", (error) => {
  logger.error("Job log stream Redis connection error", { error });
});

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

const insertLogs = async (events: Array<{ event: LogSyncEvent; id: string }>) => {
  return persistLogEvents(
    events.map(({ event, id }) => ({
      id,
      queue: event.queueName,
      jobId: event.jobId,
      jobTimestamp: new Date(event.jobTimestamp),
      logTimestamp: new Date(event.logTimestamp),
      logSeq: event.logSeq,
      level: event.level,
      message: event.message,
    })),
  );
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
    const response = await streamRedis.call(
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
  const response = await streamRedis.call(
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
