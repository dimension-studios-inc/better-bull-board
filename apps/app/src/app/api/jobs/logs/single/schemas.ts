import { getJobLogInputSchema, getJobLogOutputSchema } from "@better-bull-board/core/job-schemas"

import { registerApiRoute } from "~/lib/utils/client"

export const getJobLogApiRoute = registerApiRoute({
  route: "/api/jobs/logs/single",
  method: "POST",
  inputSchema: getJobLogInputSchema,
  outputSchema: getJobLogOutputSchema,
})
