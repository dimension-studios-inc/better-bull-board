import { bulkJobMutationByFiltersInputSchema, bulkMutationResultSchema } from "@better-bull-board/core/mutation-schemas"
import { registerApiRoute } from "~/lib/utils/client"

export const bulkCancelJobsByFiltersApiRoute = registerApiRoute({
  route: "/api/jobs/bulk-cancel-by-filters",
  method: "POST",
  inputSchema: bulkJobMutationByFiltersInputSchema,
  outputSchema: bulkMutationResultSchema,
})
