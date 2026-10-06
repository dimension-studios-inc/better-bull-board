import { listStuckRuns } from "@better-bull-board/core/stuck-runs"
import { createAuthenticatedApiRoute } from "~/lib/utils/server"
import { getStuckRunsApiRoute } from "./schemas"

export const POST = createAuthenticatedApiRoute({
  apiRoute: getStuckRunsApiRoute,
  handler: listStuckRuns,
})
