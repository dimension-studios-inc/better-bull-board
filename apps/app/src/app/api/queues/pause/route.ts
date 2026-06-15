import { pauseQueue } from "~/lib/queue-mutations";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { pauseQueueApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: pauseQueueApiRoute,
  async handler(input) {
    try {
      return await pauseQueue(input);
    } catch (error) {
      return {
        success: false,
        message: `Failed to pause queue ${input.queueName}: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});
