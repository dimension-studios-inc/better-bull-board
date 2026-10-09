import { z } from "zod"

import { registerApiRoute } from "~/lib/utils/client"

const getQueueSummaryInput = z.object({
  queueName: z.string().min(1),
  // Period ending now, same bounds as the dashboard
  minutes: z
    .number()
    .int()
    .min(5)
    .max(30 * 24 * 60),
})

export const queueSummaryStatsOutput = z.object({
  totalRuns: z.number(),
  successes: z.number(),
  failures: z.number(),
  errorRate: z.number(),
  // Durations of the completed runs in milliseconds, null without any
  p50DurationMs: z.number().nullable(),
  p95DurationMs: z.number().nullable(),
  p99DurationMs: z.number().nullable(),
  // Set when the percentiles only cover this many of the latest completed runs
  durationSampleLimit: z.number().nullable(),
})

export const queueSummaryGraphOutput = z.object({
  timestamp: z.string(),
  completed: z.number(),
  failed: z.number(),
  // Null for buckets without any run
  errorRate: z.number().nullable(),
  p50DurationMs: z.number().nullable(),
  p95DurationMs: z.number().nullable(),
})

const getQueueSummaryOutput = z.object({
  stats: queueSummaryStatsOutput,
  graph: z.array(queueSummaryGraphOutput),
})

export const getQueueSummaryApiRoute = registerApiRoute({
  route: "/api/queues/summary",
  method: "POST",
  inputSchema: getQueueSummaryInput,
  outputSchema: getQueueSummaryOutput,
})
