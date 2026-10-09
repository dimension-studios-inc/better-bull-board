import { replayJobsMatchingFilters } from "~/lib/queue-mutations"
import { createAuthenticatedApiRoute } from "~/lib/utils/server"

import { bulkReplayJobsByFiltersApiRoute } from "./schemas"

export const POST = createAuthenticatedApiRoute({
  apiRoute: bulkReplayJobsByFiltersApiRoute,
  handler: replayJobsMatchingFilters,
})
