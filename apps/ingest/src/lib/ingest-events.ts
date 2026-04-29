import { logger } from "@rharkor/logger";
import { redis } from "~/lib/redis";

export const publishIngestEvent = (channel: string, message: string, context?: Record<string, unknown>) => {
  void redis.publish(channel, message).catch((error) => {
    logger.warn("Failed to publish ingest refresh event", {
      channel,
      message,
      ...context,
      error,
    });
  });
};
