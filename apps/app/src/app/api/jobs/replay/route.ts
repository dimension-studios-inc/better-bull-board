import { logger } from "@rharkor/logger";
import { Queue } from "bullmq";
import { redis } from "~/lib/redis";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { replayJobApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: replayJobApiRoute,
  async handler(input) {
    const { jobId, queueName } = input;

    const queue = new Queue(queueName, { connection: redis });
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new Error("Job not found");
    }

    await job.retry();

    return {
      success: true,
      message: `Job ${jobId} has been replayed successfully`,
    };
  },
});
