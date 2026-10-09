import {
  jobMutationInputSchema,
  mutationResultSchema,
} from "@better-bull-board/core/mutation-schemas"
import { z } from "zod"

import { registerApiRoute } from "~/lib/utils/client"

const bulkCancelJobsInput = z.object({
  // A selection is one page of the runs table, which holds up to 100 runs
  jobs: z.array(jobMutationInputSchema).max(100),
})

export const bulkCancelJobsApiRoute = registerApiRoute({
  route: "/api/jobs/bulk-cancel",
  method: "POST",
  inputSchema: bulkCancelJobsInput,
  outputSchema: mutationResultSchema,
})
