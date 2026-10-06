import { countJobs } from "@better-bull-board/core/jobs"
import { createAuthenticatedApiRoute } from "~/lib/utils/server"
import { countJobsApiRoute } from "./schemas"

export const POST = createAuthenticatedApiRoute({
  apiRoute: countJobsApiRoute,
  handler: countJobs,
})
