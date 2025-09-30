import { jobRunsTable } from "@better-bull-board/db/schemas/job/schema";
import { db } from "@better-bull-board/db/server";
import { logger } from "@rharkor/logger";
import { and, eq } from "drizzle-orm";
import { redis } from "./lib/redis";

const CACHE_TTL_SECONDS = 5 * 60; // 5 minutes
const CACHE_KEY_PREFIX = "bbb:job-run-id:";

const getCachedValue = async (
  jobId: string,
  enqueuedAt: Date,
): Promise<string | null> => {
  try {
    const key = `${CACHE_KEY_PREFIX}${jobId}:${enqueuedAt.getTime()}`;
    const cached = await redis.get(key);

    if (cached === null) {
      return null;
    }

    return cached;
  } catch (error) {
    logger.warn("Failed to get cached value from Redis", { jobId, error });
    return null;
  }
};

const setCachedValue = async (
  jobId: string,
  enqueuedAt: Date,
  value: string,
): Promise<void> => {
  try {
    const key = `${CACHE_KEY_PREFIX}${jobId}:${enqueuedAt.getTime()}`;
    await redis.setex(key, CACHE_TTL_SECONDS, value);
  } catch (error) {
    logger.warn("Failed to set cached value in Redis", {
      jobId,
      enqueuedAt,
      value,
      error,
    });
  }
};

export const getJobFromBullId = async (jobId: string, enqueuedAt: Date) => {
  // Check cache first
  const cachedResult = await getCachedValue(jobId, enqueuedAt);
  if (cachedResult !== null) {
    return cachedResult;
  }

  const [jobRun] = await db
    .select({ id: jobRunsTable.id })
    .from(jobRunsTable)
    .where(
      and(
        eq(jobRunsTable.jobId, jobId),
        eq(jobRunsTable.enqueuedAt, enqueuedAt),
      ),
    )
    .limit(1);

  let result: string | undefined;

  if (!jobRun) {
    result = undefined;
  } else {
    const jobRunId = jobRun.id;
    if (!jobRunId) {
      logger.warn("Invalid job run data", { jobId, enqueuedAt });
      result = undefined;
    } else {
      result = jobRunId;
    }
  }

  if (result) await setCachedValue(jobId, enqueuedAt, result);

  return result;
};

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object" || a === null || b === null) return false;

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) return false;

  return aKeys.every((k) =>
    deepEqual(
      (a as Record<string, unknown>)[k],
      (b as Record<string, unknown>)[k as keyof typeof b],
    ),
  );
}

export function getChangedKeys<T extends Record<string, unknown>>(
  newObj: T,
  oldObj: Partial<T>,
): (keyof T)[] {
  return Object.keys(newObj).filter((key) => {
    const k = key as keyof T;
    const newVal = newObj[k];
    const oldVal = oldObj[k];

    if (typeof newVal === "object" && newVal !== null) {
      return !deepEqual(newVal, oldVal);
    }
    return newVal !== oldVal;
  }) as (keyof T)[];
}
