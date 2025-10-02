import { queuesTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { logger } from "@rharkor/logger";
import { QueueEvents } from "bullmq";
import { redis } from "~/lib/redis";
import { chunk } from "~/utils";

// Single subscriber for ALL queues/jobs
let globalSubscriber: ReturnType<typeof redis.duplicate> | null = null;

// Track timeouts: Map<queueName, Map<jobId, Timeout>>
const activeTimeouts = new Map<string, Map<string, NodeJS.Timeout>>();

// Active queueEvents only
export const activeListeners = new Map<string, QueueEvents>();

async function ensureSubscriber() {
  if (globalSubscriber) return;

  globalSubscriber = redis.duplicate();
  await globalSubscriber.connect().catch(() => {});

  // Handle ALL job waiting responses
  globalSubscriber.on("pmessage", (_pattern, channel) => {
    const match = channel.match(/^bbb:queue:(.+):job:waiting:(.+)$/);
    if (!match) {
      logger.error("Invalid channel missing jobId or queueName", { channel });
      return;
    }

    const [, queueName, jobId] = match;
    if (!jobId || !queueName) {
      logger.error("Invalid channel missing jobId or queueName", { channel });
      return;
    }
    const timeouts = activeTimeouts.get(queueName);
    if (!timeouts) return;

    const timeout = timeouts.get(jobId);
    if (timeout) {
      clearTimeout(timeout);
      timeouts.delete(jobId);
    } else {
      logger.warn(
        `Received late/unknown message for job ${jobId} in ${queueName}`,
      );
    }
  });

  await globalSubscriber.psubscribe("bbb:queue:*:job:waiting:*");
}

export async function attachQueueListener(queueName: string) {
  if (activeListeners.has(queueName)) return; // already listening

  await ensureSubscriber();

  const queueEvents = new QueueEvents(queueName, { connection: redis });
  activeListeners.set(queueName, queueEvents);

  // Ensure we track timeouts for this queue
  if (!activeTimeouts.has(queueName)) {
    activeTimeouts.set(queueName, new Map());
  }

  queueEvents.on("waiting", async ({ jobId }) => {
    const timeouts = activeTimeouts.get(queueName);
    if (!timeouts) {
      logger.error("No timeouts for queue", { queueName });
      return;
    }

    // create timeout
    const timeout = setTimeout(() => {
      logger.warn(
        `⏱ No worker responded for job ${jobId} in queue ${queueName}`,
      );
      timeouts.delete(jobId);
    }, 3000);

    timeouts.set(jobId, timeout);

    // publish after scheduling timeout
    await redis.publish(
      `bbb:queue:${queueName}:job:waiting`,
      JSON.stringify({ jobId, ts: Date.now() }),
    );
  });

  queueEvents.on("error", (err) => {
    logger.error(`QueueEvents error [${queueName}]:`, err);
  });

  await queueEvents.waitUntilReady();
  logger.log(`🎧 Listening for waiting jobs on queue ${queueName}`);
}

export async function detachQueueListener(queueName: string) {
  const queueEvents = activeListeners.get(queueName);
  if (!queueEvents) return;

  await queueEvents.close();
  activeListeners.delete(queueName);

  const timeouts = activeTimeouts.get(queueName);
  if (timeouts) {
    for (const t of timeouts.values()) clearTimeout(t);
    activeTimeouts.delete(queueName);
  }

  logger.log(`🛑 Stopped listening to queue ${queueName}`);
}

export async function refreshQueueListeners() {
  const queues = await db.select().from(queuesTable);
  const queueNames = new Set(queues.map((q) => q.name));

  // --- Add new queues in batches of 50
  const toAdd = [...queueNames].filter((q) => !activeListeners.has(q));
  for (const batch of chunk(toAdd, 50)) {
    await Promise.allSettled(
      batch.map((q) =>
        attachQueueListener(q).catch((err) => {
          logger.error(`Failed to attach listener for ${q}`, err);
        }),
      ),
    );
  }

  // --- Remove old queues in batches of 50
  const toRemove = [...activeListeners.keys()].filter(
    (existing) => !queueNames.has(existing),
  );
  for (const batch of chunk(toRemove, 50)) {
    await Promise.allSettled(
      batch.map((q) =>
        detachQueueListener(q).catch((err) => {
          logger.error(`Failed to detach listener for ${q}`, err);
        }),
      ),
    );
  }
}

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
