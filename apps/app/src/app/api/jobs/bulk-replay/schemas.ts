import { jobMutationInputSchema, mutationResultSchema } from "@better-bull-board/core/mutation-schemas";
import z from "zod";
import { registerApiRoute } from "~/lib/utils/client";

export const bulkReplayJobsInput = z.object({
  jobs: z.array(jobMutationInputSchema),
});

export const bulkReplayJobsApiRoute = registerApiRoute({
  route: "/api/jobs/bulk-replay",
  method: "POST",
  inputSchema: bulkReplayJobsInput,
  outputSchema: mutationResultSchema,
});
