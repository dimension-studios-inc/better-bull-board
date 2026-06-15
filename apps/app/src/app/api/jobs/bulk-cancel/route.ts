import { cancelJob } from "~/lib/queue-mutations";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { bulkCancelJobsApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: bulkCancelJobsApiRoute,
  async handler(input) {
    const { jobs } = input;

    // Don't use promise.all to avoid race conditions
    for (const job of jobs) {
      await cancelJob(job);
    }

    return {
      success: true,
      message: `Bulk operation completed`,
    };
  },
});
