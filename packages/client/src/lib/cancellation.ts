import { logger } from "@rharkor/logger";
import { Queue, type SandboxedJob } from "bullmq";
import type Redis from "ioredis";
import { repeat } from "./utils";

export const registerCancellationListener = async (
  redis: Redis,
  jobId: string,
) => {
  await logger.init();

  const listener = redis.duplicate();
  await listener.connect().catch(() => {});

  listener.subscribe(`bbb:cancellation:${jobId}`, (err) => {
    if (err) throw err;
  });
  listener.on("message", async (channel, message) => {
    if (channel === `bbb:cancellation:${jobId}`) {
      const { id: cancelledJobId } = JSON.parse(message);
      if (cancelledJobId === jobId) {
        logger.warn(`Job ${jobId} was cancelled`);
        await redis.publish(
          `bbb:cancellation:${jobId}:pong`,
          JSON.stringify({ id: jobId }),
        );
        throw new CancellationError(`Job ${jobId} was cancelled`);
      }
    }
  });
  return {
    stop: () => {
      listener.unsubscribe();
    },
  };
};

export class CancellationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CancellationError";
  }
}

export const cancelable =
  (run: (job: SandboxedJob) => Promise<unknown>, redis: Redis) =>
  async (job: SandboxedJob) => {
    const jobId = job.id;

    const { stop } = await registerCancellationListener(redis, jobId);

    try {
      const result = await run(job);
      return result;
    } finally {
      stop();
    }
  };

export const cancelJob = async ({
  redis,
  jobId,
  queueName,
}: {
  redis: Redis;
  jobId: string;
  queueName: string;
}) => {
  //* Cancel if still in queue
  const queue = new Queue(queueName, { connection: redis });
  const job = await queue.getJob(jobId);
  if (!job) {
    return;
  }
  const status = await job.getState();
  if (status === "completed" || status === "failed") {
    return;
  }
  let removed = false;
  removed = await job
    .remove()
    .then(() => true)
    .catch(() => false);
  if (removed) {
    return;
  }
  //* Cancel if already running
  const key = `bbb:cancellation:${jobId}`;
  const pongKey = `${key}:pong`;
  // Try posting the cancellation message until we received a confirmation (10s timeout)
  const listener = redis.duplicate();
  await listener.connect().catch(() => {});
  let subscribed = false;
  listener.subscribe(pongKey, (err) => {
    if (err) throw err;
    subscribed = true;
  });
  return new Promise<void>((resolve, reject) => {
    const { cleanup: stopRepeat } = repeat(() => {
      if (subscribed) redis.publish(key, JSON.stringify({ id: jobId }));
    }).every(100);
    const cleanup = () => {
      clearTimeout(timeout);
      stopRepeat();
      listener.unsubscribe();
    };
    // Timeout
    const timeout = setTimeout(() => {
      cleanup();
      reject(
        new CancellationError(
          `Failed to cancel job ${jobId} (no response from server)`,
        ),
      );
    }, 10_000);
    // Listen for pong
    listener.on("message", (channel, message) => {
      if (channel === pongKey) {
        const { id: cancelledJobId } = JSON.parse(message);
        if (cancelledJobId === jobId) {
          cleanup();
          resolve();
        }
      }
    });
  });
};
