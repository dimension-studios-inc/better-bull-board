import { db } from "@better-bull-board/db/server"
import { logger } from "@rharkor/logger"
import { stopBackgroundTasks } from "./lib/background-tasks"
import { stopHealthServer } from "./lib/health-server"
import { redis } from "./lib/redis"
import { stopWebSocketServer } from "./lib/websocket-server"
import { stopJobStreamIngestion } from "./sync/job-stream"
import { stopJobLogStreamIngestion } from "./sync/log-stream"

// Below Kubernetes' default 30 s grace period, so ingest exits on its own before the SIGKILL.
const SHUTDOWN_TIMEOUT_MS = 25_000

let shuttingDown = false

const shutdown = async (signal: NodeJS.Signals) => {
  if (shuttingDown) {
    logger.warn(`Received ${signal} again, exiting now`)
    process.exit(1)
  }
  shuttingDown = true
  logger.log(`🛑 Received ${signal}, shutting down`)

  setTimeout(() => {
    logger.error(`Shutdown did not finish within ${SHUTDOWN_TIMEOUT_MS / 1000}s, exiting`)
    process.exit(1)
  }, SHUTDOWN_TIMEOUT_MS).unref()

  try {
    // Finish the batches and ticks in flight before closing the connections they use.
    await Promise.all([stopJobStreamIngestion(), stopJobLogStreamIngestion(), stopBackgroundTasks()])
    await Promise.all([stopWebSocketServer(), stopHealthServer()])
    await Promise.all([redis.quit(), db.$client.end()])
    logger.log("👋 Ingest stopped")
    process.exit(0)
  } catch (error) {
    logger.error("Shutdown failed", { error })
    process.exit(1)
  }
}

export const handleShutdownSignals = () => {
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => void shutdown(signal))
  }
}
