import { countJobsOutputSchema, jobFiltersSchema } from "@better-bull-board/core/job-schemas"
import { registerApiRoute } from "~/lib/utils/client"

export const countJobsApiRoute = registerApiRoute({
  route: "/api/jobs/count",
  method: "POST",
  inputSchema: jobFiltersSchema,
  outputSchema: countJobsOutputSchema,
})
