import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { replayJobHandler } from "../replay/handler";
import { bulkReplayJobsApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: bulkReplayJobsApiRoute,
  async handler(input) {
    const { jobs } = input;

    await Promise.all(jobs.map((job) => replayJobHandler(job)));

    return {
      success: true,
      message: `Bulk operation completed`,
    };
  },
});
