import { logger } from "@rharkor/logger";
import type Redis from "ioredis";

const STALE_CONSUMER_IDLE_MS = 60 * 60 * 1000;

type StreamConsumer = {
  idle: number;
  name: string;
  pending: number;
};

const parseConsumerInfo = (response: unknown): StreamConsumer[] => {
  if (!Array.isArray(response)) return [];

  return response
    .map((row): StreamConsumer | undefined => {
      if (!Array.isArray(row)) return undefined;

      const record = new Map<string, unknown>();
      for (let i = 0; i < row.length; i += 2) {
        record.set(String(row[i]), row[i + 1]);
      }

      const name = record.get("name");
      const idle = Number(record.get("idle"));
      const pending = Number(record.get("pending"));

      if (typeof name !== "string" || Number.isNaN(idle) || Number.isNaN(pending)) return undefined;
      return { idle, name, pending };
    })
    .filter((consumer): consumer is StreamConsumer => Boolean(consumer));
};

export const cleanupStaleConsumers = async ({
  client,
  group,
  stream,
}: {
  client: Redis;
  group: string;
  stream: string;
}) => {
  try {
    const response = await client.call("XINFO", "CONSUMERS", stream, group);
    const staleConsumers = parseConsumerInfo(response).filter(
      (consumer) => consumer.pending === 0 && consumer.idle >= STALE_CONSUMER_IDLE_MS,
    );

    for (const consumer of staleConsumers) {
      await client.call("XGROUP", "DELCONSUMER", stream, group, consumer.name);
    }

    if (staleConsumers.length > 0) {
      logger.debug("Removed stale Redis stream consumers", {
        group,
        removed: staleConsumers.length,
        stream,
      });
    }
  } catch (error) {
    logger.warn("Failed to clean up stale Redis stream consumers", {
      error,
      group,
      stream,
    });
  }
};
