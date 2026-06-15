import { jobRunsTable, queuesTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { and, eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import { jobMutationInputSchema, mutationResultSchema, queueMutationInputSchema } from "./mutation-schemas";

export type MutationResult = z.infer<typeof mutationResultSchema>;

type JobMutationInput = z.input<typeof jobMutationInputSchema>;
type QueueMutationInput = z.input<typeof queueMutationInputSchema>;

type CancelJobDependencies<RedisConnection> = {
  redis: RedisConnection;
  cancelBullMqJob: (input: { redis: RedisConnection; jobId: string; queueName: string }) => Promise<void>;
};

export type QueueJob = {
  name: string;
  data: unknown;
  opts: Record<string, unknown>;
  retry: () => Promise<void>;
};

export type QueueAdapter = {
  getJob: (jobId: string) => Promise<QueueJob | null>;
  add: (name: string, data: unknown, options: Record<string, unknown>) => Promise<unknown>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  obliterate: (options: { force: true }) => Promise<void>;
  close: () => Promise<void>;
};

export type QueueDependencies = {
  createQueue: (queueName: string) => QueueAdapter;
};

const getQueueNameCandidates = (queueName: string) => {
  if (queueName.startsWith("{") && queueName.endsWith("}")) {
    return [queueName, queueName.slice(1, -1)];
  }

  return [queueName, `{${queueName}}`];
};

const resolveTrackedQueueName = async (queueName: string) => {
  const candidates = getQueueNameCandidates(queueName);
  const rows = await db
    .select({ name: queuesTable.name })
    .from(queuesTable)
    .where(inArray(queuesTable.name, candidates));

  const exactMatch = rows.find((row) => row.name === queueName);
  const resolvedName = exactMatch?.name ?? rows[0]?.name;

  if (!resolvedName) {
    throw new Error(`Queue ${queueName} not found`);
  }

  return resolvedName;
};

const withQueue = async <Result>(
  queueName: string,
  dependencies: QueueDependencies,
  callback: (queue: QueueAdapter) => Promise<Result>,
) => {
  const queue = dependencies.createQueue(queueName);

  try {
    return await callback(queue);
  } finally {
    await queue.close();
  }
};

const mutationResult = (message: string): MutationResult =>
  mutationResultSchema.parse({
    success: true,
    message,
  });

export const cancelJob = async <RedisConnection>(
  input: JobMutationInput,
  dependencies: CancelJobDependencies<RedisConnection>,
): Promise<MutationResult> => {
  const { jobId, queueName } = jobMutationInputSchema.parse(input);
  const resolvedQueueName = await resolveTrackedQueueName(queueName);

  await dependencies.cancelBullMqJob({
    redis: dependencies.redis,
    jobId,
    queueName: resolvedQueueName,
  });

  await db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(jobRunsTable)
      .where(and(eq(jobRunsTable.jobId, jobId), eq(jobRunsTable.queue, resolvedQueueName)))
      .limit(1);

    if (!job) {
      throw new Error(`Job ${jobId} not found in queue ${resolvedQueueName}`);
    }

    if (job.status === "completed" || job.status === "failed") {
      return;
    }

    const [updated] = await tx
      .update(jobRunsTable)
      .set({
        status: "failed",
        errorMessage: "Job cancelled",
      })
      .where(and(eq(jobRunsTable.jobId, jobId), eq(jobRunsTable.queue, resolvedQueueName)))
      .returning();

    if (!updated) {
      throw new Error(`Updated job ${jobId} not found in queue ${resolvedQueueName}`);
    }
  });

  return mutationResult(`Job ${jobId} has been cancelled successfully`);
};

export const replayJob = async (input: JobMutationInput, dependencies: QueueDependencies): Promise<MutationResult> => {
  const { jobId, queueName } = jobMutationInputSchema.parse(input);
  const resolvedQueueName = await resolveTrackedQueueName(queueName);

  await withQueue(resolvedQueueName, dependencies, async (queue) => {
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} was not found in Redis queue ${resolvedQueueName}`);
    }

    try {
      await job.retry();
    } catch {
      await queue.add(job.name, job.data, {
        ...job.opts,
        delay: undefined,
        jobId: undefined,
        repeat: undefined,
        repeatJobKey: undefined,
        timestamp: undefined,
      });
    }
  });

  return mutationResult(`Job ${jobId} has been replayed successfully`);
};

export const pauseQueue = async (
  input: QueueMutationInput,
  dependencies: QueueDependencies,
): Promise<MutationResult> => {
  const { queueName } = queueMutationInputSchema.parse(input);
  const resolvedQueueName = await resolveTrackedQueueName(queueName);

  await withQueue(resolvedQueueName, dependencies, async (queue) => {
    await queue.pause();
    const [updatedQueue] = await db
      .update(queuesTable)
      .set({ isPaused: true })
      .where(eq(queuesTable.name, resolvedQueueName))
      .returning({ name: queuesTable.name });

    if (!updatedQueue) {
      throw new Error(`Queue ${resolvedQueueName} not found`);
    }
  });

  return mutationResult(`Queue ${resolvedQueueName} has been paused successfully`);
};

export const resumeQueue = async (
  input: QueueMutationInput,
  dependencies: QueueDependencies,
): Promise<MutationResult> => {
  const { queueName } = queueMutationInputSchema.parse(input);
  const resolvedQueueName = await resolveTrackedQueueName(queueName);

  await withQueue(resolvedQueueName, dependencies, async (queue) => {
    await queue.resume();
    const [updatedQueue] = await db
      .update(queuesTable)
      .set({ isPaused: false })
      .where(eq(queuesTable.name, resolvedQueueName))
      .returning({ name: queuesTable.name });

    if (!updatedQueue) {
      throw new Error(`Queue ${resolvedQueueName} not found`);
    }
  });

  return mutationResult(`Queue ${resolvedQueueName} has been resumed successfully`);
};

export const deleteQueue = async (
  input: QueueMutationInput,
  dependencies: QueueDependencies,
): Promise<MutationResult> => {
  const { queueName } = queueMutationInputSchema.parse(input);
  const resolvedQueueName = await resolveTrackedQueueName(queueName);

  await withQueue(resolvedQueueName, dependencies, async (queue) => {
    await queue.obliterate({ force: true });
    await db.delete(queuesTable).where(eq(queuesTable.name, resolvedQueueName));
  });

  return mutationResult(`Queue ${resolvedQueueName} has been deleted successfully`);
};
