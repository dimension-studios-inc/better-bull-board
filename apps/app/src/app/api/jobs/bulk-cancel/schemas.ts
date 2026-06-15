import { jobMutationInputSchema, mutationResultSchema } from "@better-bull-board/core/mutation-schemas";
import z from "zod";
import { registerApiRoute } from "~/lib/utils/client";

export const bulkCancelJobsInput = z.object({
  jobs: z.array(jobMutationInputSchema),
});

export const bulkCancelJobsApiRoute = registerApiRoute({
  route: "/api/jobs/bulk-cancel",
  method: "POST",
  inputSchema: bulkCancelJobsInput,
  outputSchema: mutationResultSchema,
});
