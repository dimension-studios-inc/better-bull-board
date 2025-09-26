import { logger } from "@rharkor/logger";
import { Queue } from "bullmq";
import { redis } from "~/lib/redis";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { replayJobApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: replayJobApiRoute,
  async handler(input) {
    const { jobId, queueName } = input;

    try {
      const queue = new Queue(queueName, { connection: redis });
      const job = await queue.getJob(jobId);

      if (!job) {
        return {
          success: false,
          message: `Job ${jobId} not found in queue ${queueName}`,
        };
      }

      // Create a new job with the same data and options as the original
      const newJob = await queue.add(job.name || "job", job.data, {
        priority: job.opts.priority,
        delay: job.opts.delay,
        attempts: job.opts.attempts,
        backoff: job.opts.backoff,
        removeOnComplete: job.opts.removeOnComplete,
        removeOnFail: job.opts.removeOnFail,
      });

      logger.debug(`Job ${jobId} replayed successfully as ${newJob.id}`, {
        originalJobId: jobId,
        newJobId: newJob.id,
        queueName,
      });

      return {
        success: true,
        message: `Job ${jobId} has been replayed successfully`,
        newJobId: newJob.id,
      };
    } catch (error) {
      logger.error(`Failed to replay job ${jobId}`, {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        message: `Failed to replay job ${jobId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});