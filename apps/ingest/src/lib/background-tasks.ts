const running = new Set<Promise<unknown>>()
let stopped = false

/**
 * Runs a scheduled tick unless ingest is shutting down, and lets the shutdown wait for the ticks already running:
 * they hold distributed locks and database connections.
 */
export const runBackgroundTask = <T>(task: () => Promise<T>): Promise<T | undefined> => {
  if (stopped) return Promise.resolve(undefined)
  const promise = task()
  running.add(promise)
  promise.then(
    () => running.delete(promise),
    () => running.delete(promise),
  )
  return promise
}

/** Starts no new tick and waits for the running ones to settle. */
export const stopBackgroundTasks = async () => {
  stopped = true
  await Promise.allSettled(running)
}
