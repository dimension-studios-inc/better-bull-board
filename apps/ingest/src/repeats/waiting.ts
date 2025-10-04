import { queuesTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { logger } from "@rharkor/logger";
import { QueueEvents } from "bullmq";
import { redis } from "~/lib/redis";
import { chunk } from "~/utils";
import { cleanupManager } from "~/lib/cleanup-manager";

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

    // Clear any existing timeout for this job first
    const existingTimeout = timeouts.get(jobId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
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
    const ts = Date.now();
    await redis.publish(
      `bbb:queue:${queueName}:job:waiting`,
      JSON.stringify({ jobId, ts }),
    );
    const delay = Date.now() - ts;
    if (delay > 500) {
      logger.warn(
        `⏱ Job ${jobId} in queue ${queueName} took ${delay}ms to be scheduled`,
      );
    }
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
  const refreshInterval = setInterval(() => {
    refreshQueueListeners().catch((err) => {
      logger.error("Failed to refresh queue listeners", err);
    });
  }, 60_000);
  cleanupManager.addInterval(refreshInterval);
}

// Periodic cleanup of stale timeouts (every 5 minutes)
const cleanupInterval = setInterval(() => {
  let totalTimeouts = 0;
  for (const [queueName, timeouts] of activeTimeouts.entries()) {
    totalTimeouts += timeouts.size;
    // If a queue has too many timeouts (> 1000), clear some old ones
    if (timeouts.size > 1000) {
      logger.warn(`Queue ${queueName} has ${timeouts.size} active timeouts, clearing oldest 500`);
      const entries = Array.from(timeouts.entries());
      const toClear = entries.slice(0, 500);
      for (const [jobId, timeout] of toClear) {
        clearTimeout(timeout);
        timeouts.delete(jobId);
      }
    }
  }
  
  logger.log("Active timeouts", totalTimeouts);
  logger.log("Active listeners", activeListeners.size);
}, 300_000); // 5 minutes
cleanupManager.addInterval(cleanupInterval);

///Each 10s print size of activeTimeouts and activeListeners
const debugInterval = setInterval(() => {
  let totalTimeouts = 0;
  for (const timeouts of activeTimeouts.values()) {
    totalTimeouts += timeouts.size;
  }
  logger.log("Active timeouts", totalTimeouts);
  logger.log("Active listeners", activeListeners.size);
}, 10_000);
cleanupManager.addInterval(debugInterval);

// Register cleanup function with cleanup manager
cleanupManager.addCleanupFunction(async () => {
  // Clear all timeouts
  for (const timeouts of activeTimeouts.values()) {
    for (const timeout of timeouts.values()) {
      clearTimeout(timeout);
    }
    timeouts.clear();
  }
  activeTimeouts.clear();
  
  // Close all listeners
  for (const [queueName, queueEvents] of activeListeners.entries()) {
    await queueEvents.close().catch(() => {});
  }
  activeListeners.clear();
  
  // Close global subscriber
  if (globalSubscriber) {
    await globalSubscriber.quit().catch(() => {});
    globalSubscriber = null;
  }
});
