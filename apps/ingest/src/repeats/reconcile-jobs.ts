import { jobRunsTable, queuesTable } from "@better-bull-board/db"
import { db } from "@better-bull-board/db/server"
import { logger } from "@rharkor/logger"
import { type Job, type JobType, Queue } from "bullmq"
import { and, asc, eq, inArray } from "drizzle-orm"
import { mapWithConcurrency } from "~/lib/concurrency"
import { acquireLock, releaseLock } from "~/lib/distributed-lock"
import { env } from "~/lib/env"
import { instanceId } from "~/lib/instance"
import { redis } from "~/lib/redis"
import { bullStateToPersistedStatus, formatJobRun, type JobRunInsert } from "~/sync/job-format"
import { safeUpsertJobRuns } from "~/sync/job-upsert"

const JOB_TYPES: JobType[] = ["waiting", "active", "delayed", "prioritized", "waiting-children"]
const NON_TERMINAL_STATUSES = ["waiting", "active", "delayed", "prioritized", "waiting-children", "unknown"] as const
const JOB_RECONCILE_CONCURRENCY = 5
/** A reschedule can briefly remove the Redis job; don't drop the row during that window. */
const ORPHAN_GRACE_MS = 15 * 60 * 1000

let reconcileInterval: NodeJS.Timeout | null = null
let reconcileRunning = false
let queueCursor = 0

const isBullMqJob = (job: Job | undefined): job is Job => Boolean(job?.id && typeof job.getState === "function")

const getQueueNames = async () => {
  const queues = await db.select({ name: queuesTable.name }).from(queuesTable)
  return queues.map((queue) => queue.name).sort()
}

const selectQueueBatch = (queueNames: string[]) => {
  if (queueNames.length <= env.JOB_RECONCILE_MAX_QUEUES_PER_TICK) return queueNames
  const selected = []
  for (let i = 0; i < env.JOB_RECONCILE_MAX_QUEUES_PER_TICK; i++) {
    selected.push(queueNames[(queueCursor + i) % queueNames.length])
  }
  queueCursor = (queueCursor + env.JOB_RECONCILE_MAX_QUEUES_PER_TICK) % queueNames.length
  return selected.filter((queueName): queueName is string => Boolean(queueName))
}

const reconcileRetainedBullMqJobs = async (queue: Queue, queueName: string) => {
  let start = 0
  const rows: JobRunInsert[] = []

  while (true) {
    const jobs = await queue.getJobs(JOB_TYPES, start, start + env.JOB_RECONCILE_PAGE_SIZE - 1, true)
    if (jobs.length === 0) break

    let unexpectedCount = 0
    for (const job of jobs) {
      if (!isBullMqJob(job)) {
        unexpectedCount += 1
        continue
      }

      const state = bullStateToPersistedStatus(await job.getState())
      rows.push(
        formatJobRun({
          workerId: job.processedBy,
          queueName,
          job: job.toJSON(),
          phase: "snapshot",
          state,
        }),
      )
    }

    if (unexpectedCount > 0) {
      logger.debug("Skipped unexpected BullMQ jobs during reconciliation", {
        pageSize: jobs.length,
        queueName,
        start,
        unexpectedCount,
      })
    }

    if (jobs.length < env.JOB_RECONCILE_PAGE_SIZE) break
    start += env.JOB_RECONCILE_PAGE_SIZE
  }

  await safeUpsertJobRuns(rows)
}

const reconcileMissingNonTerminalRows = async (queue: Queue, queueName: string) => {
  const staleRows = await db
    .select({
      id: jobRunsTable.id,
      jobId: jobRunsTable.jobId,
      attempt: jobRunsTable.attempt,
      enqueuedAt: jobRunsTable.enqueuedAt,
      startedAt: jobRunsTable.startedAt,
      createdAt: jobRunsTable.createdAt,
    })
    .from(jobRunsTable)
    .where(and(eq(jobRunsTable.queue, queueName), inArray(jobRunsTable.status, NON_TERMINAL_STATUSES)))
    .orderBy(asc(jobRunsTable.createdAt))
    .limit(env.JOB_RECONCILE_PAGE_SIZE)

  const orphanIdsToDelete: string[] = []
  const orphanIdsToFail: string[] = []

  for (const row of staleRows) {
    const job = await queue.getJob(row.jobId)
    // Same BullMQ id can be re-added with a new timestamp. That row is the live one; older rows are leftovers.
    if (isBullMqJob(job) && row.enqueuedAt?.getTime() === job.timestamp) {
      const state = bullStateToPersistedStatus(await job.getState())
      await safeUpsertJobRuns([
        formatJobRun({
          workerId: job.processedBy,
          queueName,
          job: job.toJSON(),
          phase: "snapshot",
          state,
        }),
      ])
      continue
    }

    const observedAt = row.enqueuedAt ?? row.createdAt
    if (Date.now() - observedAt.getTime() < ORPHAN_GRACE_MS) continue

    if (!row.startedAt && row.attempt === 0) orphanIdsToDelete.push(row.id)
    else orphanIdsToFail.push(row.id)
  }

  if (orphanIdsToDelete.length > 0) {
    await db.delete(jobRunsTable).where(inArray(jobRunsTable.id, orphanIdsToDelete))
  }

  if (orphanIdsToFail.length > 0) {
    await db
      .update(jobRunsTable)
      .set({
        status: "failed",
        finishedAt: new Date(),
        errorMessage: "Job left Redis before a terminal status was recorded",
      })
      .where(and(inArray(jobRunsTable.id, orphanIdsToFail), inArray(jobRunsTable.status, NON_TERMINAL_STATUSES)))
  }

  const retiredIds = [...orphanIdsToDelete, ...orphanIdsToFail]
  if (retiredIds.length === 0) return

  logger.info("Retired job run snapshots that are no longer in Redis", {
    deleted: orphanIdsToDelete.length,
    failed: orphanIdsToFail.length,
    queueName,
  })
  await redis.publish("bbb:ingest:events:job-refresh", "1")
  for (const id of retiredIds) {
    await redis.publish("bbb:ingest:events:single-job-refresh", id)
  }
}

const reconcileQueue = async (queueName: string) => {
  const start = Date.now()
  const lockKey = `bbb:job-reconcile-lock:${queueName}`
  const owner = `${instanceId}:${Date.now()}`
  const acquired = await acquireLock({ key: lockKey, owner, ttlMs: env.JOB_RECONCILE_INTERVAL_MS * 2 })
  if (!acquired) return

  const queue = new Queue(queueName, { connection: redis })
  try {
    await reconcileRetainedBullMqJobs(queue, queueName)
    await reconcileMissingNonTerminalRows(queue, queueName)
    logger.debug("Job reconciliation queue completed", {
      elapsedMs: Date.now() - start,
      queueName,
    })
  } catch (error) {
    logger.error(`Error reconciling queue ${queueName}`, { error })
  } finally {
    await queue.close()
    await releaseLock({ key: lockKey, owner })
  }
}

export const reconcileJobs = async () => {
  const start = Date.now()
  const queueNames = selectQueueBatch(await getQueueNames())
  await mapWithConcurrency(queueNames, JOB_RECONCILE_CONCURRENCY, reconcileQueue)
  logger.debug("Job reconciliation tick completed", {
    elapsedMs: Date.now() - start,
    queueCount: queueNames.length,
  })
}

export const autoReconcileJobs = () => {
  if (reconcileInterval) {
    clearInterval(reconcileInterval)
  }

  const run = async () => {
    if (reconcileRunning) {
      logger.warn("Skipping job reconciliation tick because previous tick is still running")
      return
    }

    reconcileRunning = true
    try {
      await reconcileJobs()
    } catch (error) {
      logger.error("Error in job reconciliation", { error })
    } finally {
      reconcileRunning = false
    }
  }

  reconcileInterval = setInterval(run, env.JOB_RECONCILE_INTERVAL_MS)

  run().catch((error) => {
    logger.error("Error in initial job reconciliation", { error })
  })

  logger.log("🔄 Job reconciliation started")
}

export const stopAutoReconcileJobs = () => {
  if (!reconcileInterval) return
  clearInterval(reconcileInterval)
  reconcileInterval = null
  logger.log("🛑 Job reconciliation stopped")
}
