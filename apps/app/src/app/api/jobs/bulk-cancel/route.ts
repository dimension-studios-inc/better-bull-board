import { cancelJobRun } from "@better-bull-board/clickhouse";
import { cancelJob } from "@better-bull-board/client/lib/cancellation";
import { jobRunsTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { eq } from "drizzle-orm";
import { redis } from "~/lib/redis";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { bulkCancelJobsApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: bulkCancelJobsApiRoute,
  async handler(input) {
    const { jobs } = input;

    const results = [];
    let cancelled = 0;
    let failed = 0;

    for (const { jobId, queueName } of jobs) {
      try {
        await cancelJob({
          redis,
          jobId,
          queueName,
        });

        // Sometimes the job doesn't exist anymore in redis so we need to ensure that it was really cancelled
        await db.transaction(async (tx) => {
          const [pgjob] = await db
            .select()
            .from(jobRunsTable)
            .where(eq(jobRunsTable.jobId, jobId))
            .limit(1);
          
          if (!pgjob) {
            throw new Error(`Job ${jobId} not found`);
          }

          if (pgjob.status !== "completed" && pgjob.status !== "failed") {
            await tx
              .update(jobRunsTable)
              .set({
                status: "failed",
                errorMessage: "Job cancelled",
              })
              .where(eq(jobRunsTable.jobId, jobId));

            // Clickhouse
            await cancelJobRun(jobId);
          }
        });

        results.push({ jobId, success: true });
        cancelled++;
      } catch (error) {
        results.push({ 
          jobId, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        failed++;
      }
    }

    return {
      success: true,
      message: `Bulk operation completed: ${cancelled} cancelled, ${failed} failed`,
      cancelled,
      failed,
      results,
    };
  },
});