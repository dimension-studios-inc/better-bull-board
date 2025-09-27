import z from "zod";
import { registerApiRoute } from "~/lib/utils/client";

export const bulkReplayJobsInput = z.object({
  jobs: z.array(
    z.object({
      jobId: z.string(),
      queueName: z.string(),
    }),
  ),
});

export const bulkReplayJobsOutput = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const bulkReplayJobsApiRoute = registerApiRoute({
  route: "/api/jobs/bulk-replay",
  method: "POST",
  inputSchema: bulkReplayJobsInput,
  outputSchema: bulkReplayJobsOutput,
});
