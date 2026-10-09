import {
  jobMutationInputSchema,
  mutationResultSchema,
} from "@better-bull-board/core/mutation-schemas"
import { z } from "zod"

import { registerApiRoute } from "~/lib/utils/client"

const bulkReplayJobsInput = z.object({
  // A selection is one page of the runs table, which holds up to 100 runs
  jobs: z.array(jobMutationInputSchema).max(100),
})

export const bulkReplayJobsApiRoute = registerApiRoute({
  route: "/api/jobs/bulk-replay",
  method: "POST",
  inputSchema: bulkReplayJobsInput,
  outputSchema: mutationResultSchema,
})
