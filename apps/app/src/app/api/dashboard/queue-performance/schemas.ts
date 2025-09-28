import z from "zod";
import { registerApiRoute } from "~/lib/utils/client";

export const getQueuePerformanceInput = z.object({
  days: z.number().min(1).max(30),
});

export const getQueuePerformanceOutput = z.array(
  z.object({
    queue: z.string(),
    totalRuns: z.number(),
    successes: z.number(),
    failures: z.number(),
    errorRate: z.number(),
    avgDuration: z.number(),
  }),
);

export const getQueuePerformanceApiRoute = registerApiRoute({
  route: "/api/dashboard/queue-performance",
  method: "POST",
  inputSchema: getQueuePerformanceInput,
  outputSchema: getQueuePerformanceOutput,
});