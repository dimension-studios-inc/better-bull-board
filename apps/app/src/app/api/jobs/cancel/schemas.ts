import z from "zod";
import { registerApiRoute } from "~/lib/utils/client";

export const cancelJobInput = z.object({
  jobId: z.string(),
  queueName: z.string(),
});

export const cancelJobOutput = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const cancelJobApiRoute = registerApiRoute({
  route: "/api/jobs/cancel",
  method: "POST",
  inputSchema: cancelJobInput,
  outputSchema: cancelJobOutput,
});
