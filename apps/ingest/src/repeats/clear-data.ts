import { jobRunsTable } from "@better-bull-board/db/schemas/job/schema"
import { db } from "@better-bull-board/db/server"
import { logger } from "@rharkor/logger"
import { formatDistance } from "date-fns"
import { inArray, lt } from "drizzle-orm"

import { isStoppingBackgroundTasks, runBackgroundTask } from "~/lib/background-tasks"
import { withLock } from "~/lib/distributed-lock"
import { env } from "~/lib/env"
import { instanceId } from "~/lib/instance"

const RETENTION_LOCK_TTL_MS = 1000 * 60 * 30
const DELETE_BATCH_SIZE = 5_000
/** Under the lock TTL; a larger backlog carries over to the next tick. */
const DELETE_TIME_BUDGET_MS = 1000 * 60 * 20

// we want do delete old data such as job runs and job logs after AUTO_DELETE_POSTGRES_DATA
export const clearData = () => {
  const autoDeletePostgresData = env.AUTO_DELETE_POSTGRES_DATA
  if (!autoDeletePostgresData) return

  const deleteData = async () => {
    await withLock({
      key: "bbb:postgres-retention-lock",
      owner: instanceId,
      ttlMs: RETENTION_LOCK_TTL_MS,
      run: async () => {
        const start = Date.now()
        const deleteDate = new Date(start - autoDeletePostgresData)
        let deleted = 0

        // Batched so each statement stays under the statement timeout: one DELETE over a backlog never
        // finishes, and the backlog then grows every hour. Deleting a run cascades to its logs.
        while (Date.now() - start < DELETE_TIME_BUDGET_MS && !isStoppingBackgroundTasks()) {
          const oldestRuns = db
            .select({ id: jobRunsTable.id })
            .from(jobRunsTable)
            .where(lt(jobRunsTable.createdAt, deleteDate))
            .orderBy(jobRunsTable.createdAt)
            .limit(DELETE_BATCH_SIZE)
          const { rowCount } = await db
            .delete(jobRunsTable)
            .where(inArray(jobRunsTable.id, oldestRuns))
          deleted += rowCount ?? 0
          if (!rowCount || rowCount < DELETE_BATCH_SIZE) break
        }

        if (deleted > 0) {
          logger.info("Deleted job runs past retention", { deleted, elapsedMs: Date.now() - start })
        }
      },
    })
  }

  setInterval(
    () => {
      runBackgroundTask(deleteData).catch((error: unknown) => {
        logger.error("Failed to clear old data", { error })
      })
    },
    1000 * 60 * 60,
  )
  runBackgroundTask(deleteData).catch((error: unknown) => {
    logger.error("Failed to clear old data on startup", { error })
  })

  logger.log(`🧹 Clearing data every ${formatDistance(autoDeletePostgresData, 0)}`)
}
