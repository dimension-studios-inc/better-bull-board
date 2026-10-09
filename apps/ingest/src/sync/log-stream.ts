import { logger } from "@rharkor/logger"
import { z } from "zod/v4"

import { env } from "~/lib/env"
import { instanceId } from "~/lib/instance"
import { redis } from "~/lib/redis"
import { persistLogEvents } from "~/sync/log-buffer"
import {
  ackAndDeleteEntries,
  cleanupStaleConsumers,
  getField,
  parseAutoClaimResponse,
  parseReadGroupResponse,
  type StreamMessage,
  trimAcknowledgedEntries,
} from "~/sync/stream-consumers"

const streamRedis = redis.duplicate()
let stopping = false
let loopDone: Promise<void> | undefined

streamRedis.on("error", (error) => {
  logger.error("Job log stream Redis connection error", { error })
})

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
})

type LogSyncEvent = z.infer<typeof logSyncEventSchema>

const parseLogSyncEvent = (payload: string): LogSyncEvent =>
  logSyncEventSchema.parse(JSON.parse(payload))

const ensureGroup = async () => {
  try {
    await redis.call(
      "XGROUP",
      "CREATE",
      env.JOB_LOG_SYNC_STREAM_KEY,
      env.JOB_LOG_SYNC_CONSUMER_GROUP,
      "0",
      "MKSTREAM",
    )
  } catch (error) {
    if (error instanceof Error && error.message.includes("BUSYGROUP")) return
    throw error
  }
}

const ackAndDelete = (ids: string[]) =>
  ackAndDeleteEntries({
    client: redis,
    group: env.JOB_LOG_SYNC_CONSUMER_GROUP,
    ids,
    stream: env.JOB_LOG_SYNC_STREAM_KEY,
  })

const STREAM_TRIM_INTERVAL_MS = 60 * 60 * 1000

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
  )
}

const processMessages = async (messages: StreamMessage[]) => {
  if (messages.length === 0) return

  const valid: Array<{ event: LogSyncEvent; id: string }> = []
  const invalidIds: string[] = []

  for (const message of messages) {
    const payload = getField(message.fields, "payload")
    if (!payload) {
      invalidIds.push(message.id)
      logger.warn("Job log stream message missing payload", { messageId: message.id })
      continue
    }

    try {
      valid.push({
        id: message.id,
        event: parseLogSyncEvent(payload),
      })
    } catch (error) {
      invalidIds.push(message.id)
      logger.error("Invalid job log stream payload", { error, messageId: message.id })
    }
  }

  if (invalidIds.length > 0) {
    await ackAndDelete(invalidIds)
  }

  if (valid.length === 0) return
  const insertedIds = await insertLogs(valid)
  await ackAndDelete(insertedIds)
}

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
    )
    return parseAutoClaimResponse(response)
  } catch (error) {
    if (!stopping) logger.warn("Unable to reclaim pending job log sync messages", { error })
    return []
  }
}

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
  )
  return parseReadGroupResponse(response)
}

export const startJobLogStreamIngestion = async () => {
  await ensureGroup()
  await cleanupStaleConsumers({
    client: redis,
    group: env.JOB_LOG_SYNC_CONSUMER_GROUP,
    stream: env.JOB_LOG_SYNC_STREAM_KEY,
  })
  const trim = () => trimAcknowledgedEntries({ client: redis, stream: env.JOB_LOG_SYNC_STREAM_KEY })
  void trim()
  setInterval(trim, STREAM_TRIM_INTERVAL_MS).unref()
  logger.log("📥 Job log stream ingestion started", {
    stream: env.JOB_LOG_SYNC_STREAM_KEY,
    group: env.JOB_LOG_SYNC_CONSUMER_GROUP,
    consumer: instanceId,
  })

  const loop = async () => {
    while (!stopping) {
      try {
        const pendingMessages = await readPendingMessages()
        if (pendingMessages.length > 0) {
          await processMessages(pendingMessages)
          continue
        }

        // The shutdown disconnects the stream connection to cut this blocking read.
        const messages = await readNewMessages().catch((error) => {
          if (stopping) return []
          throw error
        })
        await processMessages(messages)
      } catch (error) {
        logger.error("Job log stream ingestion loop failed", { error })
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }
  }

  loopDone = loop()
}

/**
 * Cuts the blocking read, then lets the batch being processed finish: it is acknowledged on the main connection.
 * Entries read but not acknowledged stay pending and are reclaimed by XAUTOCLAIM.
 */
export const stopJobLogStreamIngestion = async () => {
  stopping = true
  streamRedis.disconnect()
  await loopDone
}
