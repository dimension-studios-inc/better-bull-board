import { ingestQueues } from "@better-bull-board/ingest/repeats/queues";
import { logger } from "@rharkor/logger";
import { Queue } from "bullmq";
import { redis } from "~/lib/redis";
import { createAuthenticatedApiRoute } from "~/lib/utils";
import { pauseQueueApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: pauseQueueApiRoute,
  async handler(input) {
    const { queueName } = input;

    try {
      const queue = new Queue(queueName, { connection: redis });
      await queue.pause();

      logger.debug("Reloading queues");
      await ingestQueues();

      return {
        success: true,
        message: `Queue ${queueName} has been paused successfully`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to pause queue ${queueName}: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});
