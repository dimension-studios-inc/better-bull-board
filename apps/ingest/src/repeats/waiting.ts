import { queuesTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { logger } from "@rharkor/logger";
import { QueueEvents } from "bullmq";
import { redis } from "~/lib/redis";

// Active listeners, keyed by queue name
const activeListeners = new Map<string, QueueEvents>();

async function attachQueueListener(queueName: string) {
  if (activeListeners.has(queueName)) return; // already listening

  const queueEvents = new QueueEvents(queueName, { connection: redis });

  queueEvents.on("waiting", async ({ jobId }) => {
    const listener = redis.duplicate();
    await listener.connect().catch(() => {});

    const responseChannel = `bbb:queue:${queueName}:job:waiting:${jobId}`;

    await listener.subscribe(responseChannel);

    const timeout = setTimeout(async () => {
      logger.warn(
        `No worker responded for job ${jobId}, not inserting into bbb`,
      );
      await listener.quit();
    }, 1000);

    listener.on("message", async (channel) => {
      if (channel === responseChannel) {
        clearTimeout(timeout);
        await listener.quit();
      }
    });

    // Now publish, only after subscription is confirmed
    await redis.publish(
      `bbb:queue:${queueName}:job:waiting`,
      JSON.stringify({ jobId }),
    );
  });

  queueEvents.on("error", (err) => {
    logger.error(`⚠️ QueueEvents error [${queueName}]:`, err);
  });

  await queueEvents.waitUntilReady();
  activeListeners.set(queueName, queueEvents);
}

async function detachQueueListener(queueName: string) {
  const listener = activeListeners.get(queueName);
  if (!listener) return;

  await listener.close();
  activeListeners.delete(queueName);

  logger.info(`🛑 Stopped listening to queue ${queueName}`);
}

export async function refreshQueueListeners() {
  const queues = await db.select().from(queuesTable);
  const queueNames = new Set(queues.map((q) => q.name));

  // Add new queues
  for (const q of queueNames) {
    if (!activeListeners.has(q)) {
      await attachQueueListener(q);
    }
  }

  // Remove queues no longer in DB
  for (const existing of [...activeListeners.keys()]) {
    if (!queueNames.has(existing)) {
      await detachQueueListener(existing);
    }
  }
}

// Call this once at startup
export async function autoIngestWaitingJobs() {
  await refreshQueueListeners();
  logger.log("⏳ Ingesting waiting jobs");

  // Then refresh every 60s
  setInterval(() => {
    refreshQueueListeners().catch((err) => {
      logger.error("Failed to refresh queue listeners", err);
    });
  }, 60_000);
}
