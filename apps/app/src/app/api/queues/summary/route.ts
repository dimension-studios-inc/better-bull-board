import { getQueueSummary } from "~/app/api/queues/summary/handler"
import { getQueueSummaryApiRoute } from "~/app/api/queues/summary/schemas"
import { createAuthenticatedApiRoute } from "~/lib/utils/server"

export const POST = createAuthenticatedApiRoute({
  apiRoute: getQueueSummaryApiRoute,
  async handler(input) {
    return getQueueSummary({ queueName: input.queueName, minutes: input.minutes })
  },
})
