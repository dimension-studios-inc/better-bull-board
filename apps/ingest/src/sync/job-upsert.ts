import { jobRunsTable } from "@better-bull-board/db/schemas/job/schema";
import { db } from "@better-bull-board/db/server";
import { conflictUpdateSet } from "@better-bull-board/db/utils/conflict-update";
import { logger } from "@rharkor/logger";
import { DrizzleQueryError, getTableName, sql } from "drizzle-orm";
import { DatabaseError } from "pg";
import { env } from "~/lib/env";
import { publishIngestEvent } from "~/lib/ingest-events";
import type { JobRunInsert } from "./job-format";

async function withDeadlockRetry<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (error: unknown) {
      if (error instanceof DrizzleQueryError && error.cause instanceof DatabaseError && error.cause.code === "40P01") {
        lastErr = error;
        if (i === tries - 1) break;
        const backoff = 25 * (i + 1) + Math.floor(Math.random() * 50);
        logger.warn("Retrying job_runs upsert after Postgres deadlock", {
          attempt: i + 1,
          maxAttempts: tries,
          backoff,
        });
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }
      throw error;
    }
  }
  throw lastErr;
}

const getRetentionCutoff = () =>
  env.AUTO_DELETE_POSTGRES_DATA ? Date.now() - env.AUTO_DELETE_POSTGRES_DATA : undefined;

const getRunTimestamp = (run: JobRunInsert) => {
  const timestamp = run.createdAt ?? run.enqueuedAt;
  return timestamp ? new Date(timestamp).getTime() : undefined;
};

const isWithinRetention = (run: JobRunInsert, cutoff: number | undefined) => {
  if (!cutoff) return true;

  const timestamp = getRunTimestamp(run);
  return timestamp === undefined || timestamp >= cutoff;
};

export const upsertJobRuns = async (runs: JobRunInsert[]) => {
  if (runs.length === 0) return [];

  const retentionCutoff = getRetentionCutoff();
  const deduped = new Map<string, JobRunInsert>();
  for (const run of runs) {
    if (!isWithinRetention(run, retentionCutoff)) continue;

    const key = `${run.queue}-${run.jobId}-${run.enqueuedAt?.getTime?.() ?? run.enqueuedAt}`;
    deduped.set(key, run);
  }

  const values = Array.from(deduped.values()).sort((a, b) => {
    const queueCompare = a.queue.localeCompare(b.queue);
    if (queueCompare !== 0) return queueCompare;
    const jobCompare = a.jobId.localeCompare(b.jobId);
    if (jobCompare !== 0) return jobCompare;
    const ae = a.enqueuedAt ? new Date(a.enqueuedAt).getTime() : 0;
    const be = b.enqueuedAt ? new Date(b.enqueuedAt).getTime() : 0;
    return ae - be;
  });
  if (values.length === 0) return [];

  const tableName = getTableName(jobRunsTable);
  const statusUpdateSql = `CASE
    WHEN ${tableName}.${jobRunsTable.status.name} IN ('completed', 'failed')
      AND excluded.${jobRunsTable.status.name} NOT IN ('completed', 'failed')
      THEN ${tableName}.${jobRunsTable.status.name}
    ELSE excluded.${jobRunsTable.status.name}
  END`;
  const tagsUpdateSql = `CASE
    WHEN COALESCE(cardinality(excluded.${jobRunsTable.tags.name}), 0) > 0
      THEN excluded.${jobRunsTable.tags.name}
    ELSE ${tableName}.${jobRunsTable.tags.name}
  END`;
  const setWhere = sql.raw(`(
    ${tableName}.${jobRunsTable.attempt.name} IS DISTINCT FROM excluded.${jobRunsTable.attempt.name}
    OR ${tableName}.${jobRunsTable.startedAt.name} IS DISTINCT FROM excluded.${jobRunsTable.startedAt.name}
    OR ${tableName}.${jobRunsTable.finishedAt.name} IS DISTINCT FROM excluded.${jobRunsTable.finishedAt.name}
    OR ${tableName}.${jobRunsTable.errorMessage.name} IS DISTINCT FROM excluded.${jobRunsTable.errorMessage.name}
    OR ${tableName}.${jobRunsTable.errorStack.name} IS DISTINCT FROM excluded.${jobRunsTable.errorStack.name}
    OR ${tableName}.${jobRunsTable.result.name} IS DISTINCT FROM excluded.${jobRunsTable.result.name}
    OR ${tableName}.${jobRunsTable.backoff.name} IS DISTINCT FROM excluded.${jobRunsTable.backoff.name}
    OR ${tableName}.${jobRunsTable.createdAt.name} IS DISTINCT FROM excluded.${jobRunsTable.createdAt.name}
    OR ${tableName}.${jobRunsTable.data.name} IS DISTINCT FROM excluded.${jobRunsTable.data.name}
    OR ${tableName}.${jobRunsTable.priority.name} IS DISTINCT FROM excluded.${jobRunsTable.priority.name}
    OR ${tableName}.${jobRunsTable.delayMs.name} IS DISTINCT FROM excluded.${jobRunsTable.delayMs.name}
    OR ${tableName}.${jobRunsTable.repeatJobKey.name} IS DISTINCT FROM excluded.${jobRunsTable.repeatJobKey.name}
    OR ${tableName}.${jobRunsTable.parentJobId.name} IS DISTINCT FROM excluded.${jobRunsTable.parentJobId.name}
    OR ${tableName}.${jobRunsTable.workerId.name} IS DISTINCT FROM excluded.${jobRunsTable.workerId.name}
    OR ${tableName}.${jobRunsTable.enqueuedAt.name} IS DISTINCT FROM excluded.${jobRunsTable.enqueuedAt.name}
    OR ${tableName}.${jobRunsTable.jobId.name} IS DISTINCT FROM excluded.${jobRunsTable.jobId.name}
    OR ${tableName}.${jobRunsTable.maxAttempts.name} IS DISTINCT FROM excluded.${jobRunsTable.maxAttempts.name}
    OR ${tableName}.${jobRunsTable.queue.name} IS DISTINCT FROM excluded.${jobRunsTable.queue.name}
    OR ${tableName}.${jobRunsTable.name.name} IS DISTINCT FROM excluded.${jobRunsTable.name.name}
    OR ${tableName}.${jobRunsTable.tags.name} IS DISTINCT FROM (${tagsUpdateSql})
    OR ${tableName}.${jobRunsTable.status.name} IS DISTINCT FROM (${statusUpdateSql})
  )`);

  const inserted = await withDeadlockRetry(() =>
    db
      .insert(jobRunsTable)
      .values(values)
      .onConflictDoUpdate({
        target: [jobRunsTable.queue, jobRunsTable.jobId, jobRunsTable.enqueuedAt],
        setWhere,
        set: {
          ...conflictUpdateSet(jobRunsTable, [
            "attempt",
            "startedAt",
            "finishedAt",
            "errorMessage",
            "errorStack",
            "result",
            "backoff",
            "createdAt",
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
          ]),
          tags: sql.raw(tagsUpdateSql),
          status: sql.raw(statusUpdateSql),
        },
      })
      .returning({
        id: jobRunsTable.id,
        status: jobRunsTable.status,
      }),
  );

  publishIngestEvent("bbb:ingest:events:job-refresh", "1");
  for (const jobRun of inserted) {
    publishIngestEvent("bbb:ingest:events:single-job-refresh", jobRun.id, { jobRunId: jobRun.id });
  }

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
