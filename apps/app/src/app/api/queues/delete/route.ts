import { deleteQueue } from "~/lib/queue-mutations";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { deleteQueueApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: deleteQueueApiRoute,
  async handler(input) {
    try {
      return await deleteQueue(input);
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete queue ${input.queueName}: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});
