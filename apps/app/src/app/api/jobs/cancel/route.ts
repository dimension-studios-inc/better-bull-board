import { cancelJobRun } from "@better-bull-board/clickhouse";
import { cancelJob } from "@better-bull-board/client/lib/cancellation";
import { jobRunsTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { eq } from "drizzle-orm";
import { redis } from "~/lib/redis";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { cancelJobApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: cancelJobApiRoute,
  async handler(input) {
    const { jobId, queueName } = input;

    await cancelJob({
      redis,
      jobId,
      queueName,
    });

    //* Sometimes the job doesnt exist anymore in redis so we need to ensure that it was really cancelled
    // Postgres

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

    return {
      success: true,
      message: `Job ${jobId} has been cancelled successfully`,
    };
  },
});
