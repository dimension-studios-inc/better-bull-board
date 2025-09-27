import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { replayJobHandler } from "../replay/handler";
import { bulkReplayJobsApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: bulkReplayJobsApiRoute,
  async handler(input) {
    const { jobs } = input;

    // Don't use promise.all to avoid race conditions
    for (const job of jobs) {
      await replayJobHandler(job);
    }

    return {
      success: true,
      message: `Bulk operation completed`,
    };
  },
});
