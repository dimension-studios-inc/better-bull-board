import { z } from "zod"

export const listTopErrorsInputSchema = z.object({
  // Period ending now, from the last 5 minutes up to the last 30 days
  minutes: z
    .number()
    .int()
    .min(5)
    .max(30 * 24 * 60)
    .default(24 * 60),
  queue: z.string().optional(),
})

const topErrorGroupSchema = z.object({
  queue: z.string(),
  // Error message with ids, numbers and dates replaced by placeholders such as <id> or <n>
  normalizedMessage: z.string(),
  sampleMessage: z.string(),
  // Literal part of the message, to find the runs of the group with the runs search
  search: z.string().nullable(),
  count: z.number(),
  firstSeenAt: z.number(),
  lastSeenAt: z.number(),
})

export const listTopErrorsOutputSchema = z.object({
  errors: z.array(topErrorGroupSchema),
  scannedRuns: z.number(),
  // Only the latest failed runs of the period were grouped
  isPartial: z.boolean(),
})
