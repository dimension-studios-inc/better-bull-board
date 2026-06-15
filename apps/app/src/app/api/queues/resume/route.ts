import { resumeQueue } from "~/lib/queue-mutations";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { resumeQueueApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: resumeQueueApiRoute,
  async handler(input) {
    try {
      return await resumeQueue(input);
    } catch (error) {
      return {
        success: false,
        message: `Failed to resume queue ${input.queueName}: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});
