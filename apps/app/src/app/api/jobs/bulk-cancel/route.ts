import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { cancelJobHandler } from "../cancel/handler";
import { bulkCancelJobsApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: bulkCancelJobsApiRoute,
  async handler(input) {
    const { jobs } = input;

    await Promise.all(jobs.map((job) => cancelJobHandler(job)));

    return {
      success: true,
      message: `Bulk operation completed`,
    };
  },
});
