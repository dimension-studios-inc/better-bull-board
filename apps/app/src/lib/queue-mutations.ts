import { cancelJob as cancelBullMqJob } from "@better-bull-board/client/lib/cancellation"
import { cancellableJobStatuses, replayableJobStatuses } from "@better-bull-board/core/job-schemas"
import {
  applyToJobsMatchingFilters,
  cancelJob as cancelCoreJob,
  deleteQueue as deleteCoreQueue,
  pauseQueue as pauseCoreQueue,
  type QueueAdapter,
  replayJob as replayCoreJob,
  resumeQueue as resumeCoreQueue,
} from "@better-bull-board/core/mutations"
import { logger } from "@rharkor/logger"
import { Queue } from "bullmq"
import { redis } from "./redis"

const createQueueAdapter = (queueName: string): QueueAdapter => {
  const queue = new Queue(queueName, { connection: redis })

  return {
    getJob: async (jobId: string) => {
      const job = await queue.getJob(jobId)

      if (!job) {
        return null
      }

      return {
        name: job.name,
        data: job.data,
        opts: job.opts as Record<string, unknown>,
        retry: () => job.retry(),
      }
    },
    add: (name: string, data: unknown, options: Record<string, unknown>) => queue.add(name, data, options),
    pause: () => queue.pause(),
    resume: () => queue.resume(),
    obliterate: (options: { force: true }) => queue.obliterate(options),
    close: () => queue.close(),
  }
}

export const cancelJob = (input: { jobId: string; queueName: string }) =>
  cancelCoreJob(input, {
    cancelBullMqJob,
    redis,
  })

export const replayJob = (input: { jobId: string; queueName: string }) =>
  replayCoreJob(input, {
    createQueue: createQueueAdapter,
  })

type JobFiltersInput = Parameters<typeof applyToJobsMatchingFilters>[0]["input"]

const logBulkFailure = (action: string, job: { jobId: string; queueName: string }) => (error: unknown) => {
  logger.error(`Bulk ${action} failed for job ${job.jobId} in queue ${job.queueName}`, error)
  throw error
}

export const replayJobsMatchingFilters = (input: JobFiltersInput) =>
  applyToJobsMatchingFilters({
    input,
    statuses: replayableJobStatuses,
    action: (job) => replayJob(job).catch(logBulkFailure("replay", job)),
  })

export const cancelJobsMatchingFilters = (input: JobFiltersInput) =>
  applyToJobsMatchingFilters({
    input,
    statuses: cancellableJobStatuses,
    action: (job) => cancelJob(job).catch(logBulkFailure("cancel", job)),
  })

export const pauseQueue = (input: { queueName: string }) =>
  pauseCoreQueue(input, {
    createQueue: createQueueAdapter,
  })

export const resumeQueue = (input: { queueName: string }) =>
  resumeCoreQueue(input, {
    createQueue: createQueueAdapter,
  })

export const deleteQueue = (input: { queueName: string }) =>
  deleteCoreQueue(input, {
    createQueue: createQueueAdapter,
  })
