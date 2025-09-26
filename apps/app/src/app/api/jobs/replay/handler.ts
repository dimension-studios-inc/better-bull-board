import { logger } from "@rharkor/logger";
import { Queue } from "bullmq";
import { redis } from "~/lib/redis";

export const replayJobHandler = async (input: {
  jobId: string;
  queueName: string;
}) => {
  const { jobId, queueName } = input;

  const queue = new Queue(queueName, { connection: redis });
  const job = await queue.getJob(jobId);

  try {
    if (!job) {
      throw new Error("Job not found");
    }

    await job.retry();
    logger.log("Job retried", { jobId, queueName });
  } catch {
    await queue.add(jobId, job?.data, {
      ...job?.opts,
    });
    logger.log("Job replayed", { jobId, queueName });
  }

  return {
    success: true,
    message: `Job ${jobId} has been replayed successfully`,
  };
};
