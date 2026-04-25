import type { Job } from "bullmq";
import type Redis from "ioredis";

export const JOB_SYNC_STREAM_KEY = "bbb:worker:jobs";

export type JobSyncPhase = "waiting" | "active" | "terminal" | "snapshot";

export const emitJobSyncEvent = async <
  // biome-ignore lint/suspicious/noExplicitAny: extends bullmq
  DataType = any,
  // biome-ignore lint/suspicious/noExplicitAny: extends bullmq
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
  redis: Redis;
  workerId?: string;
  queueName: string;
  job: Job<DataType, ResultType, NameType>;
  tags?: string[];
  phase: JobSyncPhase;
  state?: string;
}) => {
  const payload = JSON.stringify({
    version: 1,
    workerId,
    queueName,
    phase,
    state,
    tags,
    job: job.toJSON(),
  });

  await redis.xadd(JOB_SYNC_STREAM_KEY, "*", "payload", payload);
};
