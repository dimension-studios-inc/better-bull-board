import z from "zod"
import { registerApiRoute } from "~/lib/utils/client"

const getQueuesNameInput = z.object({
  cursor: z.string().nullish(),
  search: z.string().optional(),
  limit: z.number().min(1).max(100).optional(),
})

const getQueuesNameOutput = z.object({
  queues: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
    }),
  ),
  nextCursor: z.string().nullable(),
  prevCursor: z.string().nullable(),
  total: z.number(),
})

export const getQueuesNameApiRoute = registerApiRoute({
  route: "/api/queues/name",
  method: "POST",
  inputSchema: getQueuesNameInput,
  outputSchema: getQueuesNameOutput,
})
