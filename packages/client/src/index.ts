import type { SandboxedJob } from "bullmq"
import type Redis from "ioredis"

import { cancelable } from "./lib/cancellation"
import { emitJobLogSyncEvent } from "./lib/log-events"
import { installConsoleRelay, withJobConsole } from "./lib/logger"

export * from "./lib/cancellation"
export * from "./lib/job-events"
export * from "./lib/log-events"
export * from "./lib/logger"
export * from "./lib/pino"
export * from "./worker"

/**
 * Install the console relay and return the patched cancelable function
 */
export const patch = (run: (job: SandboxedJob) => Promise<unknown>, redis: Redis) => {
  return async (job: SandboxedJob) => {
    installConsoleRelay()
    const pendingPublishes = new Set<Promise<void>>()
    try {
      return await withJobConsole(
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
          pendingPublishes,
        },
        () => cancelable(run, redis)(job),
      )
    } finally {
      // A failed run flushes too: its last lines are usually the ones worth reading.
      await Promise.all(pendingPublishes)
    }
  }
}
