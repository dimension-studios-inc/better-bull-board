import { replayJob } from "~/lib/queue-mutations";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { bulkReplayJobsApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: bulkReplayJobsApiRoute,
  async handler(input) {
    const { jobs } = input;

    // Don't use promise.all to avoid race conditions
    for (const job of jobs) {
      await replayJob(job);
    }

    return {
      success: true,
      message: `Bulk operation completed`,
    };
  },
});
