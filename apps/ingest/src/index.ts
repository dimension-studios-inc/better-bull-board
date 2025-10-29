import { monitorEventLoopDelay } from "node:perf_hooks";
import { logger } from "@rharkor/logger";
import { handleChannel } from "./channels";
import { env } from "./lib/env";
import { startHealthServer } from "./lib/health-server";
import { redis } from "./lib/redis";
import { startWebSocketServer } from "./lib/websocket-server";
import { migrateDatabases } from "./migration";
import { clearData } from "./repeats/clear-data";

// import { autoIngestQueues } from "./repeats/queues";
// import { stopStalledRuns } from "./repeats/stalled";

const listenToEvents = async () => {
  const subscriber = redis.duplicate();
  await subscriber.connect().catch(() => {});

  await subscriber.psubscribe("bbb:worker:*", (error) => {
    if (error) throw error;
    logger.log("📥 Ingesting data from Redis");
  });
  subscriber.on("pmessage", handleChannel);
};

const main = async () => {
  await logger.init();

  // Run database migrations first (only in production)
  await migrateDatabases();

  //! Do not await
  listenToEvents();
  clearData();
  // autoIngestQueues();
  // stopStalledRuns();

  // Start WebSocket server
  startWebSocketServer();

  // Start Health server
  startHealthServer();

  if (env.ENV === "development") {
    logger.log("🆔 Process ID", process.pid);
  }
};

// print memory usage every 10 seconds
// if (env.ENV === "development") {
//   setInterval(() => {
//     const memoryUsage = process.memoryUsage();
//     logger.subLog("Memory usage", memoryUsage.rss / 1024 / 1024);
//   }, 10_000);
// }

const h = monitorEventLoopDelay({ resolution: 20 });
h.enable();
setInterval(() => {
  const p99 = h.percentile(99) / 1e6; // ms
  if (p99 > 100) logger.warn("Event loop p99", p99, "ms");
}, 2000);

main();
