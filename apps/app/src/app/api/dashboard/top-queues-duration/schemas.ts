import z from "zod";
import { registerApiRoute } from "~/lib/utils/client";

export const getTopQueuesDurationInput = z.object({
  days: z.number().min(1).max(30),
  limit: z.number().min(1).max(20).optional().default(10),
});

export const getTopQueuesDurationOutput = z.array(
  z.object({
    queue: z.string(),
    totalDuration: z.number(),
  }),
);

export const getTopQueuesDurationApiRoute = registerApiRoute({
  route: "/api/dashboard/top-queues-duration",
  method: "POST",
  inputSchema: getTopQueuesDurationInput,
  outputSchema: getTopQueuesDurationOutput,
});
