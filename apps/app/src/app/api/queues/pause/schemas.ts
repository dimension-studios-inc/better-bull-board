import { z } from "zod";
import { registerApiRoute } from "~/lib/utils/server";

export const pauseQueueInput = z.object({
  queueName: z.string(),
});

export const pauseQueueOutput = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const pauseQueueApiRoute = registerApiRoute({
  route: "/api/queues/pause",
  method: "POST",
  inputSchema: pauseQueueInput,
  outputSchema: pauseQueueOutput,
});
