import { jobRunsTable, queuesTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

export const jobMutationInputSchema = z
  .object({
    jobId: z.string().min(1),
    queueName: z.string().min(1),
  })
  .strict();

export const queueMutationInputSchema = z
  .object({
    queueName: z.string().min(1),
  })
  .strict();

export const mutationResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type MutationResult = z.infer<typeof mutationResultSchema>;

export type JobMutationInput = z.input<typeof jobMutationInputSchema>;
export type QueueMutationInput = z.input<typeof queueMutationInputSchema>;

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

  await dependencies.cancelBullMqJob({
    redis: dependencies.redis,
    jobId,
    queueName,
  });

  await db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(jobRunsTable)
      .where(and(eq(jobRunsTable.jobId, jobId), eq(jobRunsTable.queue, queueName)))
      .limit(1);

    if (!job) {
      throw new Error(`Job ${jobId} not found in queue ${queueName}`);
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
      .where(and(eq(jobRunsTable.jobId, jobId), eq(jobRunsTable.queue, queueName)))
      .returning();

    if (!updated) {
      throw new Error(`Updated job ${jobId} not found in queue ${queueName}`);
    }
  });

  return mutationResult(`Job ${jobId} has been cancelled successfully`);
};

export const replayJob = async (input: JobMutationInput, dependencies: QueueDependencies): Promise<MutationResult> => {
  const { jobId, queueName } = jobMutationInputSchema.parse(input);

  await withQueue(queueName, dependencies, async (queue) => {
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} was not found in Redis queue ${queueName}`);
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

  await withQueue(queueName, dependencies, async (queue) => {
    await queue.pause();
    await db.update(queuesTable).set({ isPaused: true }).where(eq(queuesTable.name, queueName));
  });

  return mutationResult(`Queue ${queueName} has been paused successfully`);
};

export const resumeQueue = async (
  input: QueueMutationInput,
  dependencies: QueueDependencies,
): Promise<MutationResult> => {
  const { queueName } = queueMutationInputSchema.parse(input);

  await withQueue(queueName, dependencies, async (queue) => {
    await queue.resume();
    await db.update(queuesTable).set({ isPaused: false }).where(eq(queuesTable.name, queueName));
  });

  return mutationResult(`Queue ${queueName} has been resumed successfully`);
};

export const deleteQueue = async (
  input: QueueMutationInput,
  dependencies: QueueDependencies,
): Promise<MutationResult> => {
  const { queueName } = queueMutationInputSchema.parse(input);

  await withQueue(queueName, dependencies, async (queue) => {
    await queue.obliterate({ force: true });
    await db.delete(queuesTable).where(eq(queuesTable.name, queueName));
  });

  return mutationResult(`Queue ${queueName} has been deleted successfully`);
};
