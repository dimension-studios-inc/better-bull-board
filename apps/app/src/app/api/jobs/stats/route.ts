import { jobRunsTable } from "@better-bull-board/db"
import { db } from "@better-bull-board/db/server"
import { and, between, count, eq } from "drizzle-orm"

import { createAuthenticatedApiRoute } from "~/lib/utils/server"

import { getJobsStatsApiRoute } from "./schemas"

export const POST = createAuthenticatedApiRoute({
  apiRoute: getJobsStatsApiRoute,
  async handler(input) {
    const days = input?.days || 1
    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const dateTo = new Date()

    const [activeResult, failedResult, completedResult] = await Promise.all([
      db.select({ count: count() }).from(jobRunsTable).where(eq(jobRunsTable.status, "active")),
      db
        .select({ count: count() })
        .from(jobRunsTable)
        .where(
          and(eq(jobRunsTable.status, "failed"), between(jobRunsTable.createdAt, dateFrom, dateTo)),
        ),
      db
        .select({ count: count() })
        .from(jobRunsTable)
        .where(
          and(
            eq(jobRunsTable.status, "completed"),
            between(jobRunsTable.createdAt, dateFrom, dateTo),
          ),
        ),
    ])

    return {
      active: Number(activeResult[0]?.count ?? 0),
      failed: Number(failedResult[0]?.count ?? 0),
      completed: Number(completedResult[0]?.count ?? 0),
    }
  },
})
