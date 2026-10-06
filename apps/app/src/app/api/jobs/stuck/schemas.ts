import { listStuckRunsInputSchema, listStuckRunsOutputSchema } from "@better-bull-board/core/stuck-run-schemas"
import { registerApiRoute } from "~/lib/utils/client"

export const getStuckRunsApiRoute = registerApiRoute({
  route: "/api/jobs/stuck",
  method: "POST",
  inputSchema: listStuckRunsInputSchema,
  outputSchema: listStuckRunsOutputSchema,
})
