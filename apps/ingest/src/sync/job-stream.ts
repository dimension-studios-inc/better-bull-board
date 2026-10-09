import { logger } from "@rharkor/logger"
import { env } from "~/lib/env"
import { instanceId } from "~/lib/instance"
import { redis } from "~/lib/redis"
import { formatJobRun, parseJobSyncEvent } from "./job-format"
import { safeUpsertJobRuns } from "./job-upsert"
import { ackAndDeleteEntries, cleanupStaleConsumers, trimAcknowledgedEntries } from "./stream-consumers"

const streamRedis = redis.duplicate()
let stopping = false
let loopDone: Promise<void> | undefined

streamRedis.on("error", (error) => {
  logger.error("Job stream Redis connection error", { error })
})

type StreamMessage = {
  id: string
  fields: string[]
}

const getField = (fields: string[], key: string) => {
  const index = fields.indexOf(key)
  return index === -1 ? undefined : fields[index + 1]
}

const parseReadGroupResponse = (response: unknown): StreamMessage[] => {
  if (!Array.isArray(response)) return []
  const messages: StreamMessage[] = []
  for (const stream of response) {
    if (!Array.isArray(stream) || !Array.isArray(stream[1])) continue
    for (const message of stream[1]) {
      if (!Array.isArray(message) || typeof message[0] !== "string" || !Array.isArray(message[1])) continue
      messages.push({ id: message[0], fields: message[1].map(String) })
    }
  }
  return messages
}

const parseAutoClaimResponse = (response: unknown): StreamMessage[] => {
  if (!Array.isArray(response) || !Array.isArray(response[1])) return []
  return response[1]
    .map((message): StreamMessage | undefined => {
      if (!Array.isArray(message) || typeof message[0] !== "string" || !Array.isArray(message[1])) return undefined
      return { id: message[0], fields: message[1].map(String) }
    })
    .filter((message): message is StreamMessage => Boolean(message))
}

const ensureGroup = async () => {
  try {
    await redis.call("XGROUP", "CREATE", env.JOB_SYNC_STREAM_KEY, env.JOB_SYNC_CONSUMER_GROUP, "0", "MKSTREAM")
  } catch (error) {
    if (error instanceof Error && error.message.includes("BUSYGROUP")) return
    throw error
  }
}

const ackAndDelete = (ids: string[]) =>
  ackAndDeleteEntries({ client: redis, group: env.JOB_SYNC_CONSUMER_GROUP, ids, stream: env.JOB_SYNC_STREAM_KEY })

const STREAM_TRIM_INTERVAL_MS = 60 * 60 * 1000

const processMessages = async (messages: StreamMessage[]) => {
  if (messages.length === 0) return

  const valid = []
  const invalidIds = []

  for (const message of messages) {
    const payload = getField(message.fields, "payload")
    if (!payload) {
      invalidIds.push(message.id)
      logger.warn("Job sync stream message missing payload", { messageId: message.id })
      continue
    }

    try {
      const event = parseJobSyncEvent(payload)
      valid.push({
        id: message.id,
        row: formatJobRun({
          workerId: event.workerId,
          queueName: event.queueName,
          job: event.job,
          tags: event.tags,
          phase: event.phase,
          state: event.state,
        }),
      })
    } catch (error) {
      invalidIds.push(message.id)
      logger.error("Invalid job sync stream payload", { error, messageId: message.id })
    }
  }

  if (invalidIds.length > 0) {
    await ackAndDelete(invalidIds)
  }

  if (valid.length === 0) return
  await safeUpsertJobRuns(valid.map((message) => message.row))
  await ackAndDelete(valid.map((message) => message.id))
}

const readPendingMessages = async () => {
  try {
    const response = await streamRedis.call(
      "XAUTOCLAIM",
      env.JOB_SYNC_STREAM_KEY,
      env.JOB_SYNC_CONSUMER_GROUP,
      instanceId,
      env.JOB_SYNC_PENDING_IDLE_MS,
      "0-0",
      "COUNT",
      env.JOB_SYNC_BATCH_SIZE,
    )
    return parseAutoClaimResponse(response)
  } catch (error) {
    if (!stopping) logger.warn("Unable to reclaim pending job sync messages", { error })
    return []
  }
}

const readNewMessages = async () => {
  const response = await streamRedis.call(
    "XREADGROUP",
    "GROUP",
    env.JOB_SYNC_CONSUMER_GROUP,
    instanceId,
    "COUNT",
    env.JOB_SYNC_BATCH_SIZE,
    "BLOCK",
    5000,
    "STREAMS",
    env.JOB_SYNC_STREAM_KEY,
    ">",
  )
  return parseReadGroupResponse(response)
}

export const startJobStreamIngestion = async () => {
  await ensureGroup()
  await cleanupStaleConsumers({
    client: redis,
    group: env.JOB_SYNC_CONSUMER_GROUP,
    stream: env.JOB_SYNC_STREAM_KEY,
  })
  const trim = () => trimAcknowledgedEntries({ client: redis, stream: env.JOB_SYNC_STREAM_KEY })
  void trim()
  setInterval(trim, STREAM_TRIM_INTERVAL_MS).unref()
  logger.log("📥 Job stream ingestion started", {
    stream: env.JOB_SYNC_STREAM_KEY,
    group: env.JOB_SYNC_CONSUMER_GROUP,
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
        logger.error("Job stream ingestion loop failed", { error })
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
export const stopJobStreamIngestion = async () => {
  stopping = true
  streamRedis.disconnect()
  await loopDone
}
