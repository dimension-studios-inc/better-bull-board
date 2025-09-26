import z from "zod";
import { registerApiRoute } from "~/lib/utils/server";

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
      pattern: z.string().nullable(),
      every: z.number().nullable(),
      activeJobs: z.number(),
      failedJobs: z.number(),
      completedJobs: z.number(),
    }),
  ),
  nextCursor: z.string().nullable(),
  total: z.number(),
});

export const getQueuesTableApiRoute = registerApiRoute({
  route: "/api/queues/table",
  method: "POST",
  inputSchema: getQueuesTableInput,
  outputSchema: getQueuesTableOutput,
});
