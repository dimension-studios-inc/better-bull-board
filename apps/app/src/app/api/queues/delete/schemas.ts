import { z } from "zod";
import { registerApiRoute } from "~/lib/utils/server";

export const deleteQueueInput = z.object({
  queueName: z.string(),
});

export const deleteQueueOutput = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const deleteQueueApiRoute = registerApiRoute({
  route: "/api/queues/delete",
  method: "POST",
  inputSchema: deleteQueueInput,
  outputSchema: deleteQueueOutput,
});
