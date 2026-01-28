import { Queue } from "bullmq";
import { redis } from "~/lib/redis";

export const replayJobHandler = async (input: { jobId: string; queueName: string }) => {
  const { jobId, queueName } = input;

  const queue = new Queue(queueName, { connection: redis });
  const job = await queue.getJob(jobId);

  try {
    if (!job) {
      throw new Error("Job not found");
    }

    await job.retry();
  } catch {
    await queue.add(jobId, job?.data, {
      ...job?.opts,
      delay: undefined,
      jobId: undefined,
      repeat: undefined,
      repeatJobKey: undefined,
      timestamp: undefined,
    });
  }

  return {
    success: true,
    message: `Job ${jobId} has been replayed successfully`,
  };
};
