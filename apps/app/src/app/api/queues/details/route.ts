import { HttpError } from "@better-bull-board/core/errors"
import { jobRunsTable, jobSchedulersTable, queuesTable } from "@better-bull-board/db"
import { db } from "@better-bull-board/db/server"
import { and, eq, inArray, sql } from "drizzle-orm"
import { createAuthenticatedApiRoute } from "~/lib/utils/server"
import { getQueueDetailsApiRoute } from "./schemas"

export const POST = createAuthenticatedApiRoute({
  apiRoute: getQueueDetailsApiRoute,
  async handler({ queueName }) {
    const [queue] = await db
      .select({ id: queuesTable.id, name: queuesTable.name, isPaused: queuesTable.isPaused })
      .from(queuesTable)
      .where(eq(queuesTable.name, queueName))
      .limit(1)

    if (!queue) {
      throw new HttpError(`Queue ${queueName} not found`, 404)
    }

    const [schedulers, statusCounts] = await Promise.all([
      db
        .select({ pattern: jobSchedulersTable.pattern, every: jobSchedulersTable.every })
        .from(jobSchedulersTable)
        .where(eq(jobSchedulersTable.queueId, queue.id)),
      db
        .select({ status: jobRunsTable.status, count: sql<number>`COUNT(*)::int` })
        .from(jobRunsTable)
        .where(and(eq(jobRunsTable.queue, queue.name), inArray(jobRunsTable.status, ["waiting", "active", "delayed"])))
        .groupBy(jobRunsTable.status),
    ])

    const getCount = (status: string) => Number(statusCounts.find((row) => row.status === status)?.count ?? 0)

    return {
      name: queue.name,
      isPaused: queue.isPaused,
      patterns: schedulers.flatMap((scheduler) => (scheduler.pattern ? [scheduler.pattern] : [])),
      everys: schedulers.flatMap((scheduler) => (scheduler.every ? [scheduler.every] : [])),
      waitingJobs: getCount("waiting"),
      activeJobs: getCount("active"),
      delayedJobs: getCount("delayed"),
    }
  },
})
