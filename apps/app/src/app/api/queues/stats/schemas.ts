import z from "zod";
import { registerApiRoute } from "~/lib/utils/client";

export const getQueuesStatsOutput = z.object({
  total: z.number(),
  active: z.number(),
  withScheduler: z.number(),
});

export const getQueuesStatsApiRoute = registerApiRoute({
  route: "/api/queues/stats",
  method: "POST",
  outputSchema: getQueuesStatsOutput,
});
