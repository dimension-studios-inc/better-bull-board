import { z } from "zod"

const schedulerCursorSchema = z.object({
  // Epoch ms; null for schedulers without a next run
  nextRunAt: z.number().nullable(),
  queue: z.string(),
  key: z.string(),
})

export const listSchedulersInputSchema = z.object({
  queue: z.string().optional(),
  search: z.string().optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
  cursor: schedulerCursorSchema.nullish(),
  cursorDirection: z.enum(["next", "prev"]).optional(),
  limit: z.number().min(1).max(100).optional(),
})

export const listSchedulersOutputSchema = z.object({
  schedulers: z.array(
    z.object({
      id: z.string(),
      key: z.string(),
      name: z.string(),
      queue: z.string(),
      queueIsPaused: z.boolean(),
      pattern: z.string().nullable(),
      every: z.number().nullable(),
      tz: z.string().nullable(),
      endDate: z.coerce.date().nullable(),
      nextRunAt: z.coerce.date().nullable(),
      isMissed: z.boolean(),
      lastRun: z
        .object({
          id: z.string(),
          jobId: z.string(),
          status: z.enum(["active", "completed", "failed"]),
          at: z.coerce.date(),
        })
        .nullable(),
    }),
  ),
  nextCursor: schedulerCursorSchema.nullable(),
  prevCursor: schedulerCursorSchema.nullable(),
  total: z.number(),
})
