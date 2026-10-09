import { cancelJob } from "~/lib/queue-mutations"
import { createAuthenticatedApiRoute } from "~/lib/utils/server"

import { bulkCancelJobsApiRoute } from "./schemas"

export const POST = createAuthenticatedApiRoute({
  apiRoute: bulkCancelJobsApiRoute,
  async handler(input) {
    const { jobs } = input

    // The bulk actions by filters already act on several jobs at once; a selection is one page of runs
    await Promise.all(jobs.map((job) => cancelJob(job)))

    return {
      success: true,
      message: `Bulk operation completed`,
    }
  },
})
