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
export const patch = (
  run: (job: SandboxedJob) => Promise<unknown>,
  redis: Redis,
) => {
  return (job: SandboxedJob) => {
    installConsoleRelay();

    return withJobConsole(
      {
        id: job.id,
        publish: redis.publish.bind(redis),
        autoEmitJobLogs: true,
        autoEmitBBBLogs: true,
        job,
      },
      () => cancelable(run, redis)(job),
    );
  };
};
