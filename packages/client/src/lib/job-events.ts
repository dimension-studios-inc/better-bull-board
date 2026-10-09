import type { Job } from "bullmq"
import type Redis from "ioredis"

export const JOB_SYNC_STREAM_KEY = "bbb:worker:jobs"

export type JobSyncPhase = "waiting" | "active" | "terminal" | "snapshot"

export const emitJobSyncEvent = async <
  // oxlint-disable-next-line typescript/no-explicit-any -- same defaults as BullMQ's Job<DataType = any, ResultType = any>
  DataType = any,
  // oxlint-disable-next-line typescript/no-explicit-any -- same defaults as BullMQ's Job<DataType = any, ResultType = any>
  ResultType = any,
  NameType extends string = string,
>({
  redis,
  workerId,
  queueName,
  job,
  tags,
  phase,
  state,
}: {
  redis: Redis
  workerId?: string
  queueName: string
  job: Job<DataType, ResultType, NameType>
  tags?: string[]
  phase: JobSyncPhase
  state?: string
}) => {
  const payload = JSON.stringify({
    version: 1,
    workerId,
    queueName,
    phase,
    state,
    tags,
    job: job.toJSON(),
  })

  await redis.xadd(JOB_SYNC_STREAM_KEY, "*", "payload", payload)
}
