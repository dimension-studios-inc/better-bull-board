import z from "zod"
import { registerApiRoute } from "~/lib/utils/client"

const getTopQueuesCountInput = z.object({
  days: z.number().min(1).max(30),
  limit: z.number().min(1).max(20).optional().default(10),
})

const getTopQueuesCountOutput = z.array(
  z.object({
    queue: z.string(),
    runCount: z.number(),
  }),
)

export const getTopQueuesCountApiRoute = registerApiRoute({
  route: "/api/dashboard/top-queues-count",
  method: "POST",
  inputSchema: getTopQueuesCountInput,
  outputSchema: getTopQueuesCountOutput,
})
