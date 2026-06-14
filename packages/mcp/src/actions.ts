import { cancelJob as cancelBullMqJob } from "@better-bull-board/client/lib/cancellation";
import {
  cancelJob as cancelCoreJob,
  deleteQueue as deleteCoreQueue,
  type MutationResult,
  pauseQueue as pauseCoreQueue,
  type QueueAdapter,
  replayJob as replayCoreJob,
  resumeQueue as resumeCoreQueue,
} from "@better-bull-board/core/mutations";
import { Queue } from "bullmq";
import { redis } from "./redis";

const createQueueAdapter = (queueName: string): QueueAdapter => {
  const queue = new Queue(queueName, { connection: redis });

  return {
    getJob: async (jobId: string) => {
      const job = await queue.getJob(jobId);

      if (!job) {
        return null;
      }

      return {
        name: job.name,
        data: job.data,
        opts: job.opts as Record<string, unknown>,
        retry: () => job.retry(),
      };
    },
    add: (name: string, data: unknown, options: Record<string, unknown>) => queue.add(name, data, options),
    pause: () => queue.pause(),
    resume: () => queue.resume(),
    obliterate: (options: { force: true }) => queue.obliterate(options),
    close: () => queue.close(),
  };
};

export const cancelJob = async ({
  jobId,
  queueName,
}: {
  jobId: string;
  queueName: string;
}): Promise<MutationResult> => {
  return cancelCoreJob(
    { jobId, queueName },
    {
      cancelBullMqJob,
      redis,
    },
  );
};

export const replayJob = async ({ jobId, queueName }: { jobId: string; queueName: string }): Promise<MutationResult> =>
  replayCoreJob(
    { jobId, queueName },
    {
      createQueue: createQueueAdapter,
    },
  );

export const pauseQueue = async ({ queueName }: { queueName: string }): Promise<MutationResult> =>
  pauseCoreQueue(
    { queueName },
    {
      createQueue: createQueueAdapter,
    },
  );

export const resumeQueue = async ({ queueName }: { queueName: string }): Promise<MutationResult> =>
  resumeCoreQueue(
    { queueName },
    {
      createQueue: createQueueAdapter,
    },
  );

export const deleteQueue = async ({ queueName }: { queueName: string }): Promise<MutationResult> =>
  deleteCoreQueue(
    { queueName },
    {
      createQueue: createQueueAdapter,
    },
  );
