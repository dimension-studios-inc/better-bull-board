import type Redis from "ioredis";

export const JOB_LOG_SYNC_STREAM_KEY = "bbb:worker:job-logs";

export type JobLogSyncLevel = "debug" | "error" | "info" | "log" | "warn";

export type JobLogSyncEventInput = {
  jobId: string;
  jobTimestamp: number;
  level: JobLogSyncLevel;
  logSeq: number;
  logTimestamp: number;
  message: string;
  queueName: string;
};

export type JobLogSyncEventPayload = JobLogSyncEventInput & {
  version: 1;
  workerId: string;
};

export const emitJobLogSyncEvent = async ({
  redis,
  workerId,
  ...event
}: JobLogSyncEventInput & {
  redis: Redis;
  workerId: string;
}) => {
  const payload: JobLogSyncEventPayload = {
    version: 1,
    workerId,
    ...event,
  };

  await redis.xadd(JOB_LOG_SYNC_STREAM_KEY, "*", "payload", JSON.stringify(payload));
};
