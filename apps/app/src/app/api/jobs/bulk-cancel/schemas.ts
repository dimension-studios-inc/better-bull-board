import z from "zod";
import { registerApiRoute } from "~/lib/utils/client";

export const bulkCancelJobsInput = z.object({
  jobs: z.array(z.object({
    jobId: z.string(),
    queueName: z.string(),
  })),
});

export const bulkCancelJobsOutput = z.object({
  success: z.boolean(),
  message: z.string(),
  cancelled: z.number(),
  failed: z.number(),
  results: z.array(z.object({
    jobId: z.string(),
    success: z.boolean(),
    error: z.string().optional(),
  })),
});

export const bulkCancelJobsApiRoute = registerApiRoute({
  route: "/api/jobs/bulk-cancel",
  method: "POST",
  inputSchema: bulkCancelJobsInput,
  outputSchema: bulkCancelJobsOutput,
});