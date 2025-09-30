import { logger } from "@rharkor/logger";
import { handleChannel } from "./channels";
import { redis } from "./lib/redis";
import { startWebSocketServer } from "./lib/websocket-server";
import { startHealthServer } from "./lib/health-server";
import { migrateDatabases } from "./migration";
import { clearData } from "./repeats/clear-data";
import { autoIngestQueues } from "./repeats/queues";
import { stopStalledRuns } from "./repeats/stalled";
import { autoIngestWaitingJobs } from "./repeats/waiting";

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
  autoIngestQueues();
  stopStalledRuns();
  autoIngestWaitingJobs();

  // Start WebSocket server
  startWebSocketServer();
  
  // Start Health server
  startHealthServer();
};

main();
