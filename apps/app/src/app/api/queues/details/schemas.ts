import z from "zod"

import { registerApiRoute } from "~/lib/utils/client"

const getQueueDetailsInput = z.object({
  queueName: z.string().min(1),
})

export const queueDetailsOutput = z.object({
  name: z.string(),
  isPaused: z.boolean(),
  patterns: z.array(z.string()),
  everys: z.array(z.number()),
  waitingJobs: z.number(),
  activeJobs: z.number(),
  delayedJobs: z.number(),
})

export const getQueueDetailsApiRoute = registerApiRoute({
  route: "/api/queues/details",
  method: "POST",
  inputSchema: getQueueDetailsInput,
  outputSchema: queueDetailsOutput,
})
