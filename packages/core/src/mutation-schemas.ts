import { z } from "zod"

import { jobFiltersSchema } from "./job-schemas"

// Keeps a single request bounded: narrow the filters to go beyond it
export const BULK_JOB_ACTION_LIMIT = 5000

export const jobMutationInputSchema = z
  .object({
    jobId: z.string().min(1),
    queueName: z.string().min(1),
  })
  .strict()

export const queueMutationInputSchema = z
  .object({
    queueName: z.string().min(1),
  })
  .strict()

export const mutationResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
})

export const bulkJobMutationByFiltersInputSchema = z
  .object({
    filters: jobFiltersSchema,
  })
  .strict()

export const bulkMutationResultSchema = z.object({
  succeeded: z.number(),
  skipped: z.number(),
  failed: z.number(),
  limitReached: z.boolean(),
})
