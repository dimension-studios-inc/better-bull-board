import {
  bulkJobMutationByFiltersInputSchema,
  bulkMutationResultSchema,
} from "@better-bull-board/core/mutation-schemas"

import { registerApiRoute } from "~/lib/utils/client"

export const bulkReplayJobsByFiltersApiRoute = registerApiRoute({
  route: "/api/jobs/bulk-replay-by-filters",
  method: "POST",
  inputSchema: bulkJobMutationByFiltersInputSchema,
  outputSchema: bulkMutationResultSchema,
})
