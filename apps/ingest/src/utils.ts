import { jobRunsTable } from "@better-bull-board/db/schemas/job/schema";
import { db } from "@better-bull-board/db/server";
import { logger } from "@rharkor/logger";
import { eq } from "drizzle-orm";
import { redis } from "./lib/redis";

const CACHE_TTL_SECONDS = 5 * 60; // 5 minutes
const CACHE_KEY_PREFIX = "bbb:job-run-id:";

const getCachedValue = async (jobId: string): Promise<string | null> => {
  try {
    const key = `${CACHE_KEY_PREFIX}${jobId}`;
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

const setCachedValue = async (jobId: string, value: string): Promise<void> => {
  try {
    const key = `${CACHE_KEY_PREFIX}${jobId}`;
    await redis.setex(key, CACHE_TTL_SECONDS, value);
  } catch (error) {
    logger.warn("Failed to set cached value in Redis", { jobId, value, error });
  }
};

export const getJobFromBullId = async (jobId: string) => {
  // Check cache first
  const cachedResult = await getCachedValue(jobId);
  if (cachedResult !== null) {
    return cachedResult;
  }

  const [jobRun] = await db
    .select({ id: jobRunsTable.id })
    .from(jobRunsTable)
    .where(eq(jobRunsTable.jobId, jobId))
    .limit(1);

  let result: string | undefined;

  if (!jobRun) {
    result = undefined;
  } else {
    const jobRunId = jobRun.id;
    if (!jobRunId) {
      logger.warn("Invalid job run data", { jobId });
      result = undefined;
    } else {
      result = jobRunId;
    }
  }

  if (result) await setCachedValue(jobId, result);

  return result;
};
