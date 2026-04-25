import { jobRunsTable } from "@better-bull-board/db/schemas/job/schema";
import { db } from "@better-bull-board/db/server";
import { conflictUpdateSet } from "@better-bull-board/db/utils/conflict-update";
import { logger } from "@rharkor/logger";
import { getTableName, sql } from "drizzle-orm";
import { redis } from "~/lib/redis";
import type { JobRunInsert } from "./job-format";

export const upsertJobRuns = async (runs: JobRunInsert[]) => {
  if (runs.length === 0) return [];

  const deduped = new Map<string, JobRunInsert>();
  for (const run of runs) {
    const key = `${run.queue}-${run.jobId}-${run.enqueuedAt?.getTime?.() ?? run.enqueuedAt}`;
    deduped.set(key, run);
  }

  const values = Array.from(deduped.values()).sort((a, b) => {
    const ae = a.enqueuedAt ? new Date(a.enqueuedAt).getTime() : 0;
    const be = b.enqueuedAt ? new Date(b.enqueuedAt).getTime() : 0;
    if (ae !== be) return ae - be;
    const queueCompare = a.queue.localeCompare(b.queue);
    if (queueCompare !== 0) return queueCompare;
    return a.jobId.localeCompare(b.jobId);
  });

  const tableName = getTableName(jobRunsTable);
  const inserted = await db
    .insert(jobRunsTable)
    .values(values)
    .onConflictDoUpdate({
      target: [jobRunsTable.queue, jobRunsTable.jobId, jobRunsTable.enqueuedAt],
      set: {
        ...conflictUpdateSet(jobRunsTable, [
          "attempt",
          "startedAt",
          "finishedAt",
          "errorMessage",
          "errorStack",
          "result",
          "backoff",
          "data",
          "priority",
          "delayMs",
          "repeatJobKey",
          "parentJobId",
          "workerId",
          "enqueuedAt",
          "jobId",
          "maxAttempts",
          "queue",
          "name",
          "tags",
        ]),
        status: sql.raw(`CASE
          WHEN ${tableName}.${jobRunsTable.status.name} IN ('completed', 'failed')
            AND excluded.${jobRunsTable.status.name} NOT IN ('completed', 'failed')
            THEN ${tableName}.${jobRunsTable.status.name}
          ELSE excluded.${jobRunsTable.status.name}
        END`),
      },
    })
    .returning({
      id: jobRunsTable.id,
      status: jobRunsTable.status,
    });

  await redis.publish("bbb:ingest:events:job-refresh", "1");
  await Promise.all(inserted.map((jobRun) => redis.publish("bbb:ingest:events:single-job-refresh", jobRun.id)));
  return inserted;
};

export const safeUpsertJobRuns = async (runs: JobRunInsert[]) => {
  try {
    return await upsertJobRuns(runs);
  } catch (error) {
    logger.error("Error in batch job upsert", {
      error,
      batchSize: runs.length,
    });
    throw error;
  }
};
