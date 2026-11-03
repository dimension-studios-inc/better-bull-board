import { getJobLog } from "@better-bull-board/core/jobs"

import { createAuthenticatedApiRoute } from "~/lib/utils/server"

import { getJobLogApiRoute } from "./schemas"

export const POST = createAuthenticatedApiRoute({
  apiRoute: getJobLogApiRoute,
  handler: getJobLog,
})
