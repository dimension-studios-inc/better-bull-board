import { replayJob } from "~/lib/queue-mutations"
import { createAuthenticatedApiRoute } from "~/lib/utils/server"

import { bulkReplayJobsApiRoute } from "./schemas"

export const POST = createAuthenticatedApiRoute({
  apiRoute: bulkReplayJobsApiRoute,
  async handler(input) {
    const { jobs } = input

    // The bulk actions by filters already act on several jobs at once; a selection is one page of runs
    await Promise.all(jobs.map((job) => replayJob(job)))

    return {
      success: true,
      message: `Bulk operation completed`,
    }
  },
})
