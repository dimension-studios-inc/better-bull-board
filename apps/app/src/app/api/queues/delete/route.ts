import { ingestQueues } from "@better-bull-board/ingest/repeats/queues";
import { logger } from "@rharkor/logger";
import { Queue } from "bullmq";
import { redis } from "~/lib/redis";
import { createApiRoute } from "~/lib/utils";
import { deleteQueueApiRoute } from "./schemas";

export const POST = createApiRoute({
  apiRoute: deleteQueueApiRoute,
  async handler(input) {
    const { queueName } = input;

    try {
      const queue = new Queue(queueName, { connection: redis });
      await queue.obliterate({ force: true });

      logger.debug("Reloading queues");
      await ingestQueues();

      return {
        success: true,
        message: `Queue ${queueName} has been deleted successfully`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete queue ${queueName}: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});
