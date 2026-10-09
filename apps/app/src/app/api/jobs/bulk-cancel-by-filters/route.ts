import { cancelJobsMatchingFilters } from "~/lib/queue-mutations"
import { createAuthenticatedApiRoute } from "~/lib/utils/server"

import { bulkCancelJobsByFiltersApiRoute } from "./schemas"

export const POST = createAuthenticatedApiRoute({
  apiRoute: bulkCancelJobsByFiltersApiRoute,
  handler: cancelJobsMatchingFilters,
})
