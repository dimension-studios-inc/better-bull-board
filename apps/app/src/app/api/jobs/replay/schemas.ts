import z from "zod";
import { registerApiRoute } from "~/lib/utils/client";

export const replayJobInput = z.object({
  jobId: z.string(),
  queueName: z.string(),
});

export const replayJobOutput = z.object({
  success: z.boolean(),
  message: z.string(),
  newJobId: z.string().optional(),
});

export const replayJobApiRoute = registerApiRoute({
  route: "/api/jobs/replay",
  method: "POST",
  inputSchema: replayJobInput,
  outputSchema: replayJobOutput,
});