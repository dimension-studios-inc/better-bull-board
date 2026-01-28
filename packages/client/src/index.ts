import type { SandboxedJob } from "bullmq";
import type Redis from "ioredis";
import { cancelable } from "./lib/cancellation";
import { installConsoleRelay, withJobConsole } from "./lib/logger";

export * from "./lib/cancellation";
export * from "./lib/logger";
export * from "./worker";

/**
 * Install the console relay and return the patched cancelable function
 */
export const patch = (run: (job: SandboxedJob) => Promise<unknown>, redis: Redis) => {
  return async (job: SandboxedJob) => {
    // biome-ignore lint/suspicious/noConfusingVoidType: _
    const pendingPublishes = new Set<Promise<number | void>>();
    installConsoleRelay({
      addPendingPublish: (publish) => {
        pendingPublishes.add(publish);
      },
      removePendingPublish: (publish) => {
        pendingPublishes.delete(publish);
      },
    });

    async function flushConsoleRelay() {
      await Promise.all([...pendingPublishes]);
    }

    const result = await withJobConsole(
      {
        id: job.id,
        publish: redis.publish.bind(redis),
        autoEmitJobLogs: true,
        autoEmitBBBLogs: true,
        job,
      },
      () => cancelable(run, redis)(job),
    );
    await flushConsoleRelay();
    return result;
  };
};
