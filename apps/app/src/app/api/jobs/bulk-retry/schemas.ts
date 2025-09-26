import z from "zod";
import { registerApiRoute } from "~/lib/utils/client";

export const bulkRetryJobsInput = z.object({
  jobs: z.array(z.object({
    jobId: z.string(),
    queueName: z.string(),
  })),
});

export const bulkRetryJobsOutput = z.object({
  success: z.boolean(),
  message: z.string(),
  retried: z.number(),
  failed: z.number(),
  results: z.array(z.object({
    jobId: z.string(),
    success: z.boolean(),
    error: z.string().optional(),
  })),
});

export const bulkRetryJobsApiRoute = registerApiRoute({
  route: "/api/jobs/bulk-retry",
  method: "POST",
  inputSchema: bulkRetryJobsInput,
  outputSchema: bulkRetryJobsOutput,
});