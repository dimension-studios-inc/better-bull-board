import { jobSchedulersTable, queuesTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { logger } from "@rharkor/logger";
import { Queue } from "bullmq";
import { and, eq, notInArray } from "drizzle-orm";
import type Redis from "ioredis";
import type { Cluster } from "ioredis";
import { mapWithConcurrency } from "~/lib/concurrency";
import { withLock } from "~/lib/distributed-lock";
import { instanceId } from "~/lib/instance";
import { redis } from "~/lib/redis";
import { getChangedKeys } from "~/utils";

const maxCount = 150000;
const maxTime = 40000;
const QUEUE_INGEST_CONCURRENCY = 5;

// Store interval ID for cleanup
let queueIngestionInterval: NodeJS.Timeout | null = null;
let queueIngestionRunning = false;

// https://github.com/taskforcesh/taskforce-connector/blob/722b0e649452468d617ce239fb5dc534705a7d48/lib/queue-factory.ts#L27
const scanForQueues = async (node: Redis | Cluster, startTime: number) => {
  let cursor = "0";
  const keys = [];
  let scanCount = 0;
  do {
    const [nextCursor, scannedKeys] = await node.scan(cursor, "MATCH", "*:*:id", "COUNT", maxCount, "TYPE", "string");
    cursor = nextCursor;
    scanCount += 1;

    keys.push(...scannedKeys);
  } while (Date.now() - startTime < maxTime && cursor !== "0");

  return {
    complete: cursor === "0",
    elapsedMs: Date.now() - startTime,
    keys,
    scanCount,
  };
};

export const ingestQueues = async () => {
  const lockedResult = await withLock({
    key: "bbb:queues-ingest-lock",
    owner: instanceId,
    ttlMs: 55_000,
    run: ingestQueuesUnsafe,
  });
  return lockedResult;
};

const ingestQueuesUnsafe = async () => {
  const start = Date.now();
  try {
    const scan = await scanForQueues(redis, Date.now());
    // <namespace>:<queueName>:id
    const allQueuesNames = Array.from(
      new Set(scan.keys.map((key) => key.split(":")[1]).filter((queueName) => queueName !== undefined)),
    ).sort();

    logger.debug("Queue discovery completed", {
      complete: scan.complete,
      elapsedMs: scan.elapsedMs,
      keyCount: scan.keys.length,
      queueCount: allQueuesNames.length,
      scanCount: scan.scanCount,
    });

    if (scan.complete) {
      if (allQueuesNames.length > 0) {
        await db.delete(queuesTable).where(notInArray(queuesTable.name, allQueuesNames));
      } else {
        await db.delete(queuesTable);
      }
    } else {
      logger.warn("Skipping missing queue deletion after incomplete Redis queue scan", {
        elapsedMs: scan.elapsedMs,
        keyCount: scan.keys.length,
        queueCount: allQueuesNames.length,
        scanCount: scan.scanCount,
      });
    }

    await mapWithConcurrency(allQueuesNames, QUEUE_INGEST_CONCURRENCY, async (queueName) => {
      try {
        const queue = await upsertQueue(queueName);
        await upsertJobSchedulers(queueName, queue.id);
      } catch (error) {
        logger.error(`Error processing queue ${queueName}:`, error);
      }
    });

    logger.debug("Queue ingestion completed", {
      elapsedMs: Date.now() - start,
      queueCount: allQueuesNames.length,
    });
  } catch (error) {
    logger.error("Error in queue ingestion:", error);
    throw error;
  }
};

export const autoIngestQueues = async () => {
  // Clear any existing interval
  if (queueIngestionInterval) {
    clearInterval(queueIngestionInterval);
  }

  const run = async () => {
    if (queueIngestionRunning) {
      logger.warn("Skipping queue ingestion tick because previous tick is still running");
      return;
    }

    queueIngestionRunning = true;
    try {
      await ingestQueues();
    } catch (error) {
      logger.error("Error in queue ingestion:", error);
    } finally {
      queueIngestionRunning = false;
    }
  };

  queueIngestionInterval = setInterval(run, 60_000);

  run().catch((error) => {
    logger.error("Error in initial queue ingestion:", error);
  });

  logger.log("🔄 Queues ingestion started");
};

// Function to stop auto ingestion and cleanup
export const stopAutoIngestQueues = () => {
  if (queueIngestionInterval) {
    clearInterval(queueIngestionInterval);
    queueIngestionInterval = null;
    logger.log("🛑 Queues ingestion stopped");
  }
};

const upsertQueue = async (queueName: string) => {
  const queue = new Queue(queueName, { connection: redis });

  try {
    const isPaused = await queue.isPaused();
    const params: typeof queuesTable.$inferInsert = {
      name: queueName,
      defaultJobOptions: queue.defaultJobOptions,
      isPaused,
    };

    const [existingQueue] = await db.select().from(queuesTable).where(eq(queuesTable.name, queueName));
    let updatedQueue: typeof queuesTable.$inferSelect;
    if (existingQueue) {
      // Check if we need to update the queue
      const needUpdate = getChangedKeys(params, existingQueue);
      if (needUpdate.length === 0) {
        return existingQueue;
      }
      logger.debug(`Need to update queue ${queueName} with keys: ${needUpdate.join(", ")}`);

      const _updatedQueue = await db
        .update(queuesTable)
        .set(params)
        .where(eq(queuesTable.name, queueName))
        .returning()
        .then(([updatedQueue]) => updatedQueue);
      logger.log(`Updated queue ${queueName}`);
      if (!_updatedQueue) {
        throw new Error("Failed to update queue");
      }
      updatedQueue = _updatedQueue;
      await redis.publish("bbb:ingest:events:single-queue-refresh", queueName);
      await redis.publish("bbb:ingest:events:queue-refresh", "1");
    } else {
      const _createdQueue = await db
        .insert(queuesTable)
        .values(params)
        .returning()
        .then(([updatedQueue]) => updatedQueue);
      logger.log(`Created queue ${queueName}`);
      if (!_createdQueue) {
        throw new Error("Failed to create queue");
      }
      updatedQueue = _createdQueue;
      await redis.publish("bbb:ingest:events:single-queue-refresh", queueName);
      await redis.publish("bbb:ingest:events:queue-refresh", "1");
    }
    return updatedQueue;
  } finally {
    // Always close the queue connection, even if an error occurs
    await queue.close();
  }
};

const upsertJobSchedulers = async (queueName: string, queueId: string) => {
  const queue = new Queue(queueName, { connection: redis });

  try {
    const jobSchedulers = await queue.getJobSchedulers();
    const params: (typeof jobSchedulersTable.$inferInsert)[] = jobSchedulers.map((jobScheduler) => ({
      queueId,
      key: jobScheduler.key,
      name: jobScheduler.name,
      limit: jobScheduler.limit ?? null,
      endDate: jobScheduler.endDate ? new Date(jobScheduler.endDate) : null,
      tz: jobScheduler.tz ?? null,
      pattern: jobScheduler.pattern ?? null,
      every: jobScheduler.every ?? null,
      template: jobScheduler.template ?? null,
    }));
    const newKeys = params.map((p) => p.key);
    // 🔴 First remove old schedulers that are not in the new list
    await db.delete(jobSchedulersTable).where(
      and(
        eq(jobSchedulersTable.queueId, queueId),
        newKeys.length > 0 ? notInArray(jobSchedulersTable.key, newKeys) : undefined, // prevent empty IN
      ),
    );
    // 🟢 Then insert or update the new ones
    await Promise.all(
      params.map(async (param) => {
        const [existingJobScheduler] = await db
          .select()
          .from(jobSchedulersTable)
          .where(eq(jobSchedulersTable.key, param.key));
        if (existingJobScheduler) {
          const needUpdate = getChangedKeys(param, existingJobScheduler);
          if (needUpdate.length === 0) return;
          await db.update(jobSchedulersTable).set(param).where(eq(jobSchedulersTable.key, param.key));
          logger.log(`Updated job scheduler ${param.key} following keys have changed: ${needUpdate.join(", ")}`);
          logger.debug(param.template, existingJobScheduler.template);
        } else {
          await db.insert(jobSchedulersTable).values(param);
          logger.log(`Created job scheduler ${param.key}`);
        }
        await redis.publish("bbb:ingest:events:single-job-scheduler-refresh", param.key);
        await redis.publish("bbb:ingest:events:job-scheduler-refresh", "1");
      }),
    );
  } finally {
    //! This part is crucial to avoid memory leaks
    (await queue.jobScheduler).removeAllListeners();
    await (await queue.jobScheduler).close();
    // Always close the queue connection, even if an error occurs
    await queue.close();
  }
};

// Graceful shutdown function
export const cleanupQueues = async () => {
  stopAutoIngestQueues();
  logger.log("🧹 Queue ingestion cleanup completed");
};
