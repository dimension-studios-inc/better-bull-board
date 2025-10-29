import { jobRunsTable } from "@better-bull-board/db/schemas/job/schema";
import { db } from "@better-bull-board/db/server";
import { logger } from "@rharkor/logger";
import { Queue } from "bullmq";
import { and, eq, lte, or } from "drizzle-orm";
import { redis } from "~/lib/redis";

export const stopStalledRuns = async () => {
  const refreshStalledRuns = async () => {
    const now = new Date();
    const canBeStalledBefore = new Date(now.getTime() - 1000 * 60 * 60 * 24); // 24 hours

    //* Retrieve all jobs that are still running and have been running for more than 24 hours
    const stalledRuns = await db
      .select()
      .from(jobRunsTable)
      .where(
        and(
          or(
            eq(jobRunsTable.status, "active"),
            eq(jobRunsTable.status, "waiting"),
          ),
          lte(jobRunsTable.createdAt, canBeStalledBefore),
        ),
      );

    //* Verify their status in redis directly
    stalledRuns.length &&
      logger.debug(
        `Found ${stalledRuns.length} potential stalled runs (> 24h)`,
      );
    for (const _run of stalledRuns) {
      const queue = new Queue(_run.queue, { connection: redis });
      const job = await queue.getJob(_run.id);
      if (!job) {
        logger.warn(`Run ${_run.id} is stalled, updating status`);
        await db
          .update(jobRunsTable)
          .set({ status: "failed" })
          .where(eq(jobRunsTable.id, _run.id));
        continue;
      }
      const jobStatus = await job.getState();
      if (jobStatus === _run.status) continue;
      logger.warn(`Run ${_run.id} is stalled, updating status`);
      await redis.publish(
        "bbb:worker:job",
        JSON.stringify({
          id: job?.processedBy,
          job,
          tags: undefined,
          queueName: job?.queueName,
        }),
      );
      await queue.close();
    }
  };

  setInterval(
    () => {
      refreshStalledRuns();
    },
    1000 * 60 * 60, // every hour
  );
  refreshStalledRuns();

  logger.log(`🛑 Stopping stalled runs`);
};
