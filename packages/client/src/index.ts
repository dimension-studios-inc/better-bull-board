import type { SandboxedJob } from "bullmq";
import type Redis from "ioredis";
import { cancelable } from "./lib/cancellation";
import { emitJobLogSyncEvent } from "./lib/log-events";
import { installConsoleRelay, withJobConsole } from "./lib/logger";

export * from "./lib/cancellation";
export * from "./lib/job-events";
export * from "./lib/log-events";
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
        emitBBBLog: (event) =>
          emitJobLogSyncEvent({
            redis,
            workerId: job.id,
            ...event,
          }),
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
