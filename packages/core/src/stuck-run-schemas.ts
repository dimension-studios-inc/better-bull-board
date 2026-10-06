import { z } from "zod"

export const listStuckRunsInputSchema = z.object({
  /** Only check these run ids, e.g. the runs shown on a page */
  ids: z.array(z.uuid()).max(100).optional(),
  limit: z.number().min(1).max(100).optional(),
})

export const listStuckRunsOutputSchema = z.object({
  runs: z.array(
    z.object({
      id: z.string(),
      jobId: z.string(),
      queue: z.string(),
      name: z.string().nullable(),
      workerId: z.string().nullable(),
      startedAt: z.number(),
      runningForMs: z.number(),
      thresholdMs: z.number(),
      p95Ms: z.number().nullable(),
      sampleSize: z.number(),
    }),
  ),
  /** All stuck runs, including the ones past the limit */
  total: z.number(),
})
