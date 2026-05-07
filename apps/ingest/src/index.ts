import { monitorEventLoopDelay } from "node:perf_hooks";
import { logger } from "@rharkor/logger";
import { env } from "./lib/env";
import { startHealthServer } from "./lib/health-server";
import { startWebSocketServer } from "./lib/websocket-server";
import { migrateDatabases } from "./migration";
import { clearData } from "./repeats/clear-data";
import { startDashboardRollups } from "./repeats/dashboard-rollups";
import { startJobTagsRefresh } from "./repeats/job-tags";
import { autoIngestQueues } from "./repeats/queues";
import { autoReconcileJobs } from "./repeats/reconcile-jobs";
import { startJobStreamIngestion } from "./sync/job-stream";
import { autoResolveBufferedJobLogs } from "./sync/log-buffer";
import { startJobLogStreamIngestion } from "./sync/log-stream";

const main = async () => {
  await logger.init();

  // Run database migrations first (only in production)
  await migrateDatabases();

  //! Do not await
  startJobStreamIngestion().catch((error) => {
    logger.error("Failed to start job stream ingestion", { error });
  });
  startJobLogStreamIngestion().catch((error) => {
    logger.error("Failed to start job log stream ingestion", { error });
  });
  autoResolveBufferedJobLogs();
  clearData();
  startDashboardRollups();
  startJobTagsRefresh();
  autoIngestQueues();
  autoReconcileJobs();

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
  h.reset();
  if (p99 > 100) logger.warn("Event loop p99", p99, "ms");
}, 2000);

main();
