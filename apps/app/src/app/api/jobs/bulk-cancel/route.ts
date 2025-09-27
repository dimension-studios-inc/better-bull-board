import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { cancelJobHandler } from "../cancel/handler";
import { bulkCancelJobsApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: bulkCancelJobsApiRoute,
  async handler(input) {
    const { jobs } = input;

    // Don't use promise.all to avoid race conditions
    for (const job of jobs) {
      await cancelJobHandler(job);
    }

    return {
      success: true,
      message: `Bulk operation completed`,
    };
  },
});
