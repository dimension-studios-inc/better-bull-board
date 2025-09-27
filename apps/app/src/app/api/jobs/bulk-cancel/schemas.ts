import z from "zod";
import { registerApiRoute } from "~/lib/utils/client";

export const bulkCancelJobsInput = z.object({
  jobs: z.array(
    z.object({
      jobId: z.string(),
      queueName: z.string(),
    }),
  ),
});

export const bulkCancelJobsOutput = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const bulkCancelJobsApiRoute = registerApiRoute({
  route: "/api/jobs/bulk-cancel",
  method: "POST",
  inputSchema: bulkCancelJobsInput,
  outputSchema: bulkCancelJobsOutput,
});
