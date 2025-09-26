import { z } from "zod";
import { registerApiRoute } from "~/lib/utils/server";

export const resumeQueueInput = z.object({
  queueName: z.string(),
});

export const resumeQueueOutput = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const resumeQueueApiRoute = registerApiRoute({
  route: "/api/queues/resume",
  method: "POST",
  inputSchema: resumeQueueInput,
  outputSchema: resumeQueueOutput,
});
