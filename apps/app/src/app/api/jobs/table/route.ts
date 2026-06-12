import { listJobs } from "@better-bull-board/core";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getJobsTableApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getJobsTableApiRoute,
  handler: listJobs,
});
