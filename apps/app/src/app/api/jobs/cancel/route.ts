import { cancelJob } from "@better-bull-board/client/lib/cancellation";
import { logger } from "@rharkor/logger";
import { redis } from "~/lib/redis";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { cancelJobApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: cancelJobApiRoute,
  async handler(input) {
    const { jobId, queueName } = input;

    try {
      await cancelJob({
        redis,
        jobId,
        queueName,
      });

      logger.debug(`Job ${jobId} in queue ${queueName} cancelled successfully`);

      return {
        success: true,
        message: `Job ${jobId} has been cancelled successfully`,
      };
    } catch (error) {
      logger.error(`Failed to cancel job ${jobId}`, {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        message: `Failed to cancel job ${jobId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});