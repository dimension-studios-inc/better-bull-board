import { Queue } from "bullmq";
import { redis } from "~/lib/redis";

export const createJobHandler = async (input: {
  queueName: string;
  jobName: string;
  data?: Record<string, unknown>;
  options?: {
    delay?: number;
    priority?: number;
    attempts?: number;
  };
}) => {
  const { queueName, jobName, data = {}, options = {} } = input;

  const queue = new Queue(queueName, { connection: redis });

  try {
    const job = await queue.add(jobName, data, {
      delay: options.delay,
      priority: options.priority,
      attempts: options.attempts || 1,
    });

    if (!job.id) {
      throw new Error("Failed to create job - no job ID returned");
    }

    return {
      success: true,
      jobId: job.id,
      message: `Job "${jobName}" created successfully in queue "${queueName}"`,
    };
  } catch (error) {
    throw new Error(`Failed to create job: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
};