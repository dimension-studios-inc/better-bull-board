import { jobSchedulersTable, queuesTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { logger } from "@rharkor/logger";
import { Queue } from "bullmq";
import { and, eq, notInArray } from "drizzle-orm";
import type Redis from "ioredis";
import type { Cluster } from "ioredis";
import { redis } from "~/lib/redis";
import { getChangedKeys } from "~/utils";

const maxCount = 150000;
const maxTime = 40000;

// https://github.com/taskforcesh/taskforce-connector/blob/722b0e649452468d617ce239fb5dc534705a7d48/lib/queue-factory.ts#L27
const scanForQueues = async (node: Redis | Cluster, startTime: number) => {
  let cursor = "0";
  const keys = [];
  do {
    const [nextCursor, scannedKeys] = await node.scan(
      cursor,
      "MATCH",
      "*:*:id",
      "COUNT",
      maxCount,
      "TYPE",
      "string",
    );
    cursor = nextCursor;

    keys.push(...scannedKeys);
  } while (Date.now() - startTime < maxTime && cursor !== "0");

  return keys;
};

export const ingestQueues = async () => {
  const allQueuesKeys = await scanForQueues(redis, Date.now());
  // <namespace>:<queueName>:id
  const allQueuesNames = allQueuesKeys
    .map((key) => key.split(":")[1])
    .filter((queueName) => queueName !== undefined);

  //* Delete all missing queues from database
  await db
    .delete(queuesTable)
    .where(notInArray(queuesTable.name, allQueuesNames));

  //* Upserting queues in database
  await Promise.all(
    allQueuesNames.map(async (queueName) => {
      // First upsert the queue
      const queue = await upsertQueue(queueName);
      // Then upsert the job schedulers
      await upsertJobSchedulers(queueName, queue.id);
    }),
  );
};

export const autoIngestQueues = async () => {
  setInterval(() => {
    ingestQueues();
  }, 60_000);
  ingestQueues();

  logger.log("🔄 Queues ingestion started");
};

const upsertQueue = async (queueName: string) => {
  const queue = new Queue(queueName);
  const isPaused = await queue.isPaused();
  const params: typeof queuesTable.$inferInsert = {
    name: queueName,
    defaultJobOptions: queue.defaultJobOptions,
    isPaused,
  };

  const [existingQueue] = await db
    .select()
    .from(queuesTable)
    .where(eq(queuesTable.name, queueName));
  let updatedQueue: typeof queuesTable.$inferSelect;
  if (existingQueue) {
    // Check if we need to update the queue
    const needUpdate = getChangedKeys(params, existingQueue);
    if (needUpdate.length === 0) {
      return existingQueue;
    }
    logger.debug(
      `Need to update queue ${queueName} with keys: ${needUpdate.join(", ")}`,
    );

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
    redis.publish("bbb:ingest:events:queue-refresh", queueName);
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
    redis.publish("bbb:ingest:events:queue-refresh", queueName);
  }
  return updatedQueue;
};

const upsertJobSchedulers = async (queueName: string, queueId: string) => {
  const queue = new Queue(queueName);
  const jobSchedulers = await queue.getJobSchedulers();

  const params: (typeof jobSchedulersTable.$inferInsert)[] = jobSchedulers.map(
    (jobScheduler) => ({
      queueId,
      key: jobScheduler.key,
      name: jobScheduler.name,
      limit: jobScheduler.limit ?? null,
      endDate: jobScheduler.endDate ? new Date(jobScheduler.endDate) : null,
      tz: jobScheduler.tz ?? null,
      pattern: jobScheduler.pattern ?? null,
      every: jobScheduler.every ?? null,
      template: jobScheduler.template ?? null,
    }),
  );

  const newKeys = params.map((p) => p.key);

  // 🔴 First remove old schedulers that are not in the new list
  await db.delete(jobSchedulersTable).where(
    and(
      eq(jobSchedulersTable.queueId, queueId),
      newKeys.length > 0
        ? notInArray(jobSchedulersTable.key, newKeys)
        : undefined, // prevent empty IN
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

        logger.debug(
          `Need to update job scheduler ${param.key} with keys: ${needUpdate.join(", ")}`,
        );

        await db
          .update(jobSchedulersTable)
          .set(param)
          .where(eq(jobSchedulersTable.key, param.key));

        logger.log(`Updated job scheduler ${param.key}`);
      } else {
        await db.insert(jobSchedulersTable).values(param);
        logger.log(`Created job scheduler ${param.key}`);
      }

      redis.publish("bbb:ingest:events:job-scheduler-refresh", param.key);
    }),
  );
};
