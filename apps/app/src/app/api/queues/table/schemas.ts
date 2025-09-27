import z from "zod";
import { registerApiRoute } from "~/lib/utils/client";

export const getQueuesTableInput = z.object({
  cursor: z.string().nullish(),
  search: z.string().optional(),
  timePeriod: z.enum(["1", "3", "7", "30"]).optional().default("1"),
  limit: z.number().min(1).max(100).optional(),
});

export const getQueuesTableOutput = z.object({
  queues: z.array(
    z.object({
      name: z.string(),
      isPaused: z.boolean(),
      patterns: z.array(z.string()),
      everys: z.array(z.number()),
      activeJobs: z.number(),
      failedJobs: z.number(),
      completedJobs: z.number(),
      chartData: z.array(
        z.object({
          timestamp: z.string(),
          completed: z.number(),
          failed: z.number(),
        }),
      ),
    }),
  ),
  nextCursor: z.string().nullable(),
  prevCursor: z.string().nullable(),
  total: z.number(),
});

export const getQueuesTableApiRoute = registerApiRoute({
  route: "/api/queues/table",
  method: "POST",
  inputSchema: getQueuesTableInput,
  outputSchema: getQueuesTableOutput,
});
