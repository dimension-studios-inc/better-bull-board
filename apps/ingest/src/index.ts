import { logger } from "@rharkor/logger";
import { handleChannel } from "./channels";
import { env } from "./lib/env";
import { startHealthServer } from "./lib/health-server";
import { redis } from "./lib/redis";
import { startWebSocketServer } from "./lib/websocket-server";
import { migrateDatabases } from "./migration";
import { clearData } from "./repeats/clear-data";
import { autoIngestQueues } from "./repeats/queues";
import { stopStalledRuns } from "./repeats/stalled";
import { autoIngestWaitingJobs } from "./repeats/waiting";
import { cleanupManager } from "./lib/cleanup-manager";

let eventSubscriber: ReturnType<typeof redis.duplicate> | null = null;

const listenToEvents = async () => {
  eventSubscriber = redis.duplicate();
  await eventSubscriber.connect().catch(() => {});

  await eventSubscriber.psubscribe("bbb:worker:*", (error) => {
    if (error) throw error;
    logger.log("📥 Ingesting data from Redis");
  });
  eventSubscriber.on("pmessage", handleChannel);
};

const main = async () => {
  await logger.init();

  // Run database migrations first (only in production)
  await migrateDatabases();

  //! Do not await
  listenToEvents();
  clearData();
  autoIngestQueues();
  stopStalledRuns();
  autoIngestWaitingJobs();

  // Start WebSocket server
  startWebSocketServer();

  // Start Health server
  startHealthServer();

  if (env.ENV === "development") {
    logger.log("PID", process.pid);
  }
};

// Enhanced memory monitoring
let lastMemoryUsage = 0;
let memoryIncreaseCount = 0;

const memoryInterval = setInterval(() => {
  const memoryUsage = process.memoryUsage();
  const currentRSS = memoryUsage.rss / 1024 / 1024;
  
  // Log memory usage
  logger.log("Memory usage", currentRSS.toFixed(2), "MB");
  
  // Track memory increases
  if (lastMemoryUsage > 0) {
    const increase = currentRSS - lastMemoryUsage;
    if (increase > 5) { // More than 5MB increase
      memoryIncreaseCount++;
      logger.warn(`Memory increased by ${increase.toFixed(2)}MB (${memoryIncreaseCount} consecutive increases)`);
      
      if (memoryIncreaseCount >= 5) {
        logger.error("Potential memory leak detected: 5 consecutive significant increases");
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
          logger.log("Forced garbage collection");
        }
      }
    } else {
      memoryIncreaseCount = 0; // Reset counter
    }
  }
  
  lastMemoryUsage = currentRSS;
}, 10_000);
cleanupManager.addInterval(memoryInterval);

// Register cleanup functions
cleanupManager.addCleanupFunction(async () => {
  if (eventSubscriber) {
    await eventSubscriber.quit().catch(() => {});
    eventSubscriber = null;
  }
});

cleanupManager.addCleanupFunction(async () => {
  await redis.quit().catch(() => {});
});

main();
