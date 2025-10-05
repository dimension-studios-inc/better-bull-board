import { queuesTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { logger } from "@rharkor/logger";
import { QueueEvents } from "bullmq";
import { redis } from "~/lib/redis";
import { chunk } from "~/utils";

// Single subscriber for ALL queues/jobs
let globalSubscriber: ReturnType<typeof redis.duplicate> | null = null;

// Active queueEvents only
export const activeListeners = new Map<string, QueueEvents>();

const handlers: Record<string, () => void> = {};

async function ensureSubscriber() {
  if (globalSubscriber) return;

  globalSubscriber = redis.duplicate();
  await globalSubscriber.connect().catch(() => {});

  await globalSubscriber.psubscribe("bbb:queue:*:job:waiting:*");

  // Handle ALL job waiting responses
  globalSubscriber?.on("pmessage", (_pattern, channel) => {
    const match = channel.match(/^bbb:queue:(.+):job:waiting:(.+)$/);
    if (!match) {
      logger.error("Invalid channel missing jobId or queueName", {
        channel,
      });
      return;
    }

    const [, eventQueueName, eventJobId] = match;
    if (!eventJobId || !eventQueueName) {
      logger.error("Invalid channel missing jobId or queueName", {
        channel,
      });
      return;
    }

    const handler =
      handlers[`bbb:queue:${eventQueueName}:job:waiting:${eventJobId}`];
    if (handler) {
      handler();
    } else {
      logger.warn("Received waiting message with no handler", { channel });
    }
  });
}

export async function attachQueueListener(queueName: string) {
  if (activeListeners.has(queueName)) return; // already listening

  await ensureSubscriber();

  const queueEvents = new QueueEvents(queueName, { connection: redis });
  activeListeners.set(queueName, queueEvents);

  queueEvents.on("waiting", async ({ jobId }) => {
    if (!globalSubscriber) {
      logger.error("Global subscriber not found");
      return;
    }

    // Create timeout
    const handlerKey = `bbb:queue:${queueName}:job:waiting:${jobId}`;
    const timeout = setTimeout(() => {
      logger.warn(
        `⏱ No worker responded for job ${jobId} in queue ${queueName}`,
      );
      delete handlers[handlerKey];
    }, 3000);
    handlers[handlerKey] = () => {
      clearTimeout(timeout);
      delete handlers[handlerKey];
    };

    // publish after scheduling timeout
    const pub = redis.duplicate();
    await pub.connect().catch(() => {});
    const t0 = process.hrtime.bigint();
    await pub.publish(
      `bbb:queue:${queueName}:job:waiting`,
      JSON.stringify({ jobId, ts: Date.now() }),
    );
    const rttMs = Number(process.hrtime.bigint() - t0) / 1e6;
    if (rttMs > 500) {
      logger.warn(
        `⏱ Job ${jobId} in queue ${queueName} took ${rttMs}ms to be scheduled`,
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

const cleanup = async () => {
  for (const listener of activeListeners.values()) {
    await listener.close();
  }
  activeListeners.clear();
  if (globalSubscriber) {
    await globalSubscriber.quit();
    globalSubscriber = null;
  }
};

process.on("exit", cleanup);
