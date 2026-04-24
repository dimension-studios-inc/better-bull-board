import { jobRunsTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { logger } from "@rharkor/logger";
import { Queue } from "bullmq";
import { sql } from "drizzle-orm";
import { redis } from "../src/lib/redis";

type StressOptions = {
  count: number;
  batchSize: number;
  queueName: string;
  jobName: string;
  minWaitMs: number;
  maxWaitMs: number;
  failureRate: number;
  maxDelayMs: number;
  payloadBytes: number;
  streamKey: string;
  reportEvery: number;
  verify: boolean;
  verifyTerminal: boolean;
  verifyTimeoutMs: number;
  verifyIntervalMs: number;
};

type ExpectedJob = {
  jobId: string;
  index: number;
  wait: number;
  shouldFail: boolean;
  payloadLength: number;
};

const getArgValue = (name: string) => {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match?.slice(prefix.length);
};

const getNumberArg = (name: string, fallback: number) => {
  const value = getArgValue(name);
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid --${name} value: ${value}`);
  }
  return parsed;
};

const getStringArg = (name: string, fallback: string) => getArgValue(name) ?? fallback;

const getBooleanArg = (name: string, fallback: boolean) => {
  const value = getArgValue(name);
  if (!value) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Invalid --${name} value: ${value}. Expected true or false.`);
};

const getPercentageArg = (name: string, fallback: number) => {
  const value = getNumberArg(name, fallback);
  if (value > 100) {
    throw new Error(`Invalid --${name} value: ${value}. Expected 0-100.`);
  }
  return value;
};

const randomInt = (min: number, max: number) => {
  if (max <= min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const readOptions = (): StressOptions => ({
  count: getNumberArg("count", 1000),
  batchSize: getNumberArg("batch-size", 100),
  queueName: getStringArg("queue", "{demo-queue}"),
  jobName: getStringArg("job-name", "bbb-stream-stress"),
  minWaitMs: getNumberArg("min-wait-ms", 0),
  maxWaitMs: getNumberArg("max-wait-ms", 5000),
  failureRate: getPercentageArg("failure-rate", 5),
  maxDelayMs: getNumberArg("max-delay-ms", 0),
  payloadBytes: getNumberArg("payload-bytes", 0),
  streamKey: getStringArg("stream-key", "bbb:worker:jobs"),
  reportEvery: getNumberArg("report-every", 1000),
  verify: getBooleanArg("verify", false),
  verifyTerminal: getBooleanArg("verify-terminal", false),
  verifyTimeoutMs: getNumberArg("verify-timeout-ms", 120_000),
  verifyIntervalMs: getNumberArg("verify-interval-ms", 2000),
});

const buildExpectedJob = ({
  index,
  runId,
  payloadBytes,
  minWaitMs,
  maxWaitMs,
  failureRate,
}: Pick<StressOptions, "failureRate" | "maxWaitMs" | "minWaitMs" | "payloadBytes"> & {
  index: number;
  runId: string;
}): ExpectedJob => ({
  jobId: `${runId}-${index}`,
  index,
  wait: randomInt(minWaitMs, maxWaitMs),
  shouldFail: Math.random() * 100 < failureRate,
  payloadLength: payloadBytes,
});

const buildPayload = ({
  index,
  runId,
  wait,
  shouldFail,
  payloadLength,
}: ExpectedJob & {
  runId: string;
}) => ({
  wait,
  shouldFail,
  stress: {
    index,
    runId,
    payload: payloadLength > 0 ? "x".repeat(payloadLength) : undefined,
  },
});

const terminalStatuses = new Set(["completed", "failed"]);

const verifyPostgresReplication = async ({
  expectedJobs,
  options,
  runId,
}: {
  expectedJobs: ExpectedJob[];
  options: StressOptions;
  runId: string;
}) => {
  const expectedFailed = expectedJobs.filter((job) => job.shouldFail).length;
  const expectedCompleted = expectedJobs.length - expectedFailed;
  const deadline = Date.now() + options.verifyTimeoutMs;

  while (true) {
    const rows = await db
      .select({
        jobId: jobRunsTable.jobId,
        queue: jobRunsTable.queue,
        name: jobRunsTable.name,
        status: jobRunsTable.status,
        data: jobRunsTable.data,
      })
      .from(jobRunsTable)
      .where(sql`${jobRunsTable.data}->'stress'->>'runId' = ${runId}`);

    const rowsById = new Map(rows.map((row) => [row.jobId, row]));
    const missing = expectedJobs.filter((job) => !rowsById.has(job.jobId));
    const mismatches = [];
    let completed = 0;
    let failed = 0;
    let terminal = 0;

    for (const expected of expectedJobs) {
      const row = rowsById.get(expected.jobId);
      if (!row) continue;

      if (row.status === "completed") completed++;
      if (row.status === "failed") failed++;
      if (terminalStatuses.has(row.status)) terminal++;

      const data = row.data as {
        wait?: number;
        shouldFail?: boolean;
        stress?: {
          index?: number;
          runId?: string;
          payload?: string;
        };
      };

      if (
        row.queue !== options.queueName ||
        row.name !== options.jobName ||
        data.wait !== expected.wait ||
        data.shouldFail !== expected.shouldFail ||
        data.stress?.index !== expected.index ||
        data.stress?.runId !== runId ||
        (data.stress?.payload?.length ?? 0) !== expected.payloadLength
      ) {
        mismatches.push({
          jobId: expected.jobId,
          status: row.status,
          expected,
          actual: {
            queue: row.queue,
            name: row.name,
            wait: data.wait,
            shouldFail: data.shouldFail,
            index: data.stress?.index,
            runId: data.stress?.runId,
            payloadLength: data.stress?.payload?.length ?? 0,
          },
        });
      }

      if (row.status === "failed" && !expected.shouldFail) {
        mismatches.push({ jobId: expected.jobId, reason: "unexpected failed status" });
      }
      if (row.status === "completed" && expected.shouldFail) {
        mismatches.push({ jobId: expected.jobId, reason: "expected failure completed instead" });
      }
    }

    const terminalSatisfied = !options.verifyTerminal || terminal === expectedJobs.length;
    if (missing.length === 0 && mismatches.length === 0 && terminalSatisfied) {
      logger.success("Postgres replication verified", {
        runId,
        expected: expectedJobs.length,
        found: rows.length,
        completed,
        failed,
        expectedCompleted,
        expectedFailed,
        terminal,
      });
      return;
    }

    if (Date.now() >= deadline) {
      logger.error("Postgres replication verification timed out", {
        runId,
        expected: expectedJobs.length,
        found: rows.length,
        missing: missing.slice(0, 20).map((job) => job.jobId),
        missingCount: missing.length,
        mismatchCount: mismatches.length,
        mismatches: mismatches.slice(0, 10),
        completed,
        failed,
        expectedCompleted,
        expectedFailed,
        terminal,
        verifyTerminal: options.verifyTerminal,
      });
      throw new Error("Postgres replication verification failed");
    }

    logger.info("Waiting for Postgres replication", {
      runId,
      expected: expectedJobs.length,
      found: rows.length,
      missing: missing.length,
      mismatchCount: mismatches.length,
      terminal,
      verifyTerminal: options.verifyTerminal,
    });

    await new Promise((resolve) => setTimeout(resolve, options.verifyIntervalMs));
  }
};

const main = async () => {
  await logger.init();

  const options = readOptions();
  const runId = `stress-${Date.now()}`;
  const queue = new Queue(options.queueName, {
    connection: redis,
    defaultJobOptions: {
      removeOnComplete: {
        age: 60 * 60,
        count: Math.max(options.count, 1000),
      },
      removeOnFail: {
        age: 60 * 60,
        count: Math.max(options.count, 1000),
      },
    },
  });

  logger.info("Starting BullMQ job stream stress test", {
    ...options,
    runId,
  });

  const startedAt = Date.now();
  let created = 0;
  const expectedJobs: ExpectedJob[] = [];

  try {
    while (created < options.count) {
      const batchCount = Math.min(options.batchSize, options.count - created);
      const jobs = Array.from({ length: batchCount }, (_, offset) => {
        const index = created + offset;
        const expectedJob = buildExpectedJob({
          index,
          runId,
          payloadBytes: options.payloadBytes,
          minWaitMs: options.minWaitMs,
          maxWaitMs: options.maxWaitMs,
          failureRate: options.failureRate,
        });
        expectedJobs.push(expectedJob);

        return {
          name: options.jobName,
          data: buildPayload({
            runId,
            ...expectedJob,
          }),
          opts: {
            jobId: expectedJob.jobId,
            delay: options.maxDelayMs > 0 ? randomInt(0, options.maxDelayMs) : undefined,
          },
        };
      });

      await queue.addBulk(jobs);
      created += batchCount;

      if (created % options.reportEvery === 0 || created === options.count) {
        const [waiting, active, completed, failed, delayed, streamLength] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
          redis.xlen(options.streamKey).catch(() => -1),
        ]);

        logger.info("Stress progress", {
          created,
          remaining: options.count - created,
          queue: {
            waiting,
            active,
            completed,
            failed,
            delayed,
          },
          jobStreamLength: streamLength,
        });
      }
    }

    const elapsedMs = Date.now() - startedAt;
    logger.success("Stress jobs enqueued", {
      created,
      elapsedMs,
      jobsPerSecond: Math.round((created / Math.max(elapsedMs, 1)) * 1000),
      runId,
    });

    if (options.verify) {
      await verifyPostgresReplication({
        expectedJobs,
        options,
        runId,
      });
    }
  } finally {
    await queue.close();
    await redis.quit();
  }
};

main()
  .then(() => {
    process.exit(0);
  })
  .catch(async (error) => {
    logger.error("Stress job stream script failed", { error });
    await redis.quit();
    process.exit(1);
  });
