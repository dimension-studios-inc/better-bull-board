import { logger } from "@rharkor/logger"
import type Redis from "ioredis"

const STALE_CONSUMER_IDLE_MS = 60 * 60 * 1000

export type StreamMessage = {
  id: string
  fields: string[]
}

export const getField = (fields: string[], key: string) => {
  const index = fields.indexOf(key)
  return index === -1 ? undefined : fields[index + 1]
}

const parseEntries = (entries: unknown): StreamMessage[] => {
  if (!Array.isArray(entries)) return []
  return entries
    .map((entry): StreamMessage | undefined => {
      if (!Array.isArray(entry) || typeof entry[0] !== "string" || !Array.isArray(entry[1]))
        return undefined
      return { id: entry[0], fields: entry[1].map(String) }
    })
    .filter((message): message is StreamMessage => Boolean(message))
}

/**
 * XREADGROUP replies with one `[stream, entries]` pair per stream under RESP2, and with a map that ioredis flattens
 * to `[stream, entries, stream, entries, …]` under RESP3, which ioredis 6 negotiates by default. Read with the RESP2
 * parser only, every entry was delivered but none parsed: they waited for XAUTOCLAIM to reclaim them.
 */
export const parseReadGroupResponse = (response: unknown): StreamMessage[] => {
  if (!Array.isArray(response)) return []
  const entryLists =
    typeof response[0] === "string"
      ? response.filter((_, index) => index % 2 === 1)
      : response.map((stream): unknown => (Array.isArray(stream) ? stream[1] : undefined))
  return entryLists.flatMap(parseEntries)
}

/** XAUTOCLAIM replies `[nextCursor, entries, deletedIds]` under both protocols. */
export const parseAutoClaimResponse = (response: unknown): StreamMessage[] =>
  Array.isArray(response) ? parseEntries(response[1]) : []

type StreamConsumer = {
  idle: number
  name: string
  pending: number
}

const parseConsumerInfo = (response: unknown): StreamConsumer[] => {
  if (!Array.isArray(response)) return []

  return response
    .map((row): StreamConsumer | undefined => {
      if (!Array.isArray(row)) return undefined

      const record = new Map<string, unknown>()
      for (let i = 0; i < row.length; i += 2) {
        record.set(String(row[i]), row[i + 1])
      }

      const name = record.get("name")
      const idle = Number(record.get("idle"))
      const pending = Number(record.get("pending"))

      if (typeof name !== "string" || Number.isNaN(idle) || Number.isNaN(pending)) return undefined
      return { idle, name, pending }
    })
    .filter((consumer): consumer is StreamConsumer => Boolean(consumer))
}

export const cleanupStaleConsumers = async ({
  client,
  group,
  stream,
}: {
  client: Redis
  group: string
  stream: string
}) => {
  try {
    const response = await client.call("XINFO", "CONSUMERS", stream, group)
    const staleConsumers = parseConsumerInfo(response).filter(
      (consumer) => consumer.pending === 0 && consumer.idle >= STALE_CONSUMER_IDLE_MS,
    )

    for (const consumer of staleConsumers) {
      await client.call("XGROUP", "DELCONSUMER", stream, group, consumer.name)
    }

    if (staleConsumers.length > 0) {
      logger.debug("Removed stale Redis stream consumers", {
        group,
        removed: staleConsumers.length,
        stream,
      })
    }
  } catch (error) {
    logger.warn("Failed to clean up stale Redis stream consumers", {
      error,
      group,
      stream,
    })
  }
}

/**
 * Acknowledge and delete processed entries in one transaction.
 *
 * Sent as two separate commands, a restart in between (deployments) left whole batches acknowledged but never
 * deleted: no longer pending, nothing would ever remove them from the stream.
 */
export const ackAndDeleteEntries = async ({
  client,
  group,
  ids,
  stream,
}: {
  client: Redis
  group: string
  ids: string[]
  stream: string
}) => {
  if (ids.length === 0) return
  const results = await client
    .multi()
    .xack(stream, group, ...ids)
    .xdel(stream, ...ids)
    .exec()
  const error = results?.find(([commandError]) => commandError)?.[0]
  if (error) throw error
}

const compareStreamIds = (a: string, b: string) => {
  const [aMs = 0n, aSeq = 0n] = a.split("-").map(BigInt)
  const [bMs = 0n, bSeq = 0n] = b.split("-").map(BigInt)
  if (aMs !== bMs) return aMs < bMs ? -1 : 1
  if (aSeq !== bSeq) return aSeq < bSeq ? -1 : 1
  return 0
}

/**
 * Delete acknowledged entries left in the stream (see ackAndDeleteEntries).
 *
 * Entries older than both the oldest pending entry and the last delivered entry of every group were delivered and
 * acknowledged: trimming them never drops an entry that still has to be processed.
 */
export const trimAcknowledgedEntries = async ({
  client,
  stream,
}: {
  client: Redis
  stream: string
}) => {
  try {
    const groups = parseInfoRows(await client.call("XINFO", "GROUPS", stream))
    if (groups.length === 0) return

    let minId: string | undefined
    for (const group of groups) {
      const groupName = String(group.get("name"))
      const pending = (await client.call("XPENDING", stream, groupName)) as [
        number,
        string | null,
        ...unknown[],
      ]
      const lastDeliveredId = group.get("last-delivered-id")
      const candidates = [
        typeof lastDeliveredId === "string" ? lastDeliveredId : "0-0",
        pending[1],
      ].filter((id): id is string => typeof id === "string")
      for (const id of candidates) {
        if (!minId || compareStreamIds(id, minId) < 0) minId = id
      }
    }
    if (!minId || minId === "0-0") return

    const trimmed = Number(await client.call("XTRIM", stream, "MINID", minId))
    if (trimmed > 0) {
      logger.log("🧹 Trimmed acknowledged Redis stream entries", { stream, trimmed })
    }
  } catch (error) {
    logger.warn("Failed to trim acknowledged Redis stream entries", { error, stream })
  }
}

const parseInfoRows = (response: unknown) =>
  Array.isArray(response)
    ? response.filter(Array.isArray).map((row: unknown[]) => {
        const record = new Map<string, unknown>()
        for (let i = 0; i < row.length; i += 2) record.set(String(row[i]), row[i + 1])
        return record
      })
    : []
