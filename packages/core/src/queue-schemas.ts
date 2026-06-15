import { z } from "zod";

export const listQueuesInputSchema = z.object({
  cursor: z
    .object({
      waitingJobs: z.number(),
      activeJobs: z.number().optional(),
      name: z.string(),
    })
    .nullish(),
  cursorDirection: z.enum(["next", "prev"]).optional(),
  search: z.string().optional(),
  sortBy: z.enum(["waitingJobs", "activeJobs"]).optional().default("waitingJobs"),
  sortDirection: z.enum(["asc", "desc"]).optional().default("desc"),
  limit: z.number().min(1).max(100).optional(),
});

export const listQueuesOutputSchema = z.object({
  queues: z.array(
    z.object({
      name: z.string(),
      isPaused: z.boolean(),
      patterns: z.array(z.string()),
      everys: z.array(z.number()),
      waitingJobs: z.number(),
      activeJobs: z.number(),
    }),
  ),
  nextCursor: z
    .object({
      waitingJobs: z.number(),
      activeJobs: z.number(),
      name: z.string(),
    })
    .nullable(),
  prevCursor: z
    .object({
      waitingJobs: z.number(),
      activeJobs: z.number(),
      name: z.string(),
    })
    .nullable(),
  total: z.number(),
});
