import { Queue } from "bullmq";
import { redis } from "~/lib/redis";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { bulkRetryJobsApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: bulkRetryJobsApiRoute,
  async handler(input) {
    const { jobs } = input;

    const results = [];
    let retried = 0;
    let failed = 0;

    // Group jobs by queue for efficiency
    const jobsByQueue = jobs.reduce((acc, job) => {
      if (!acc[job.queueName]) {
        acc[job.queueName] = [];
      }
      acc[job.queueName]!.push(job.jobId);
      return acc;
    }, {} as Record<string, string[]>);

    for (const [queueName, jobIds] of Object.entries(jobsByQueue)) {
      const queue = new Queue(queueName, { connection: redis });

      for (const jobId of jobIds) {
        try {
          const job = await queue.getJob(jobId);

          if (!job) {
            throw new Error("Job not found");
          }

          await job.retry();
          results.push({ jobId, success: true });
          retried++;
        } catch (error) {
          results.push({ 
            jobId, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          failed++;
        }
      }
    }

    return {
      success: true,
      message: `Bulk operation completed: ${retried} retried, ${failed} failed`,
      retried,
      failed,
      results,
    };
  },
});