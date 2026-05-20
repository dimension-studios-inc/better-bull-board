import { monitorEventLoopDelay, performance } from "node:perf_hooks";
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
let eventLoopUsage = performance.eventLoopUtilization();
let resourceUsage = process.resourceUsage();
h.enable();
setInterval(() => {
  const p99 = h.percentile(99) / 1e6; // ms
  const nextEventLoopUsage = performance.eventLoopUtilization(eventLoopUsage);
  const nextResourceUsage = process.resourceUsage();
  const memoryUsage = process.memoryUsage();
  const cpuUsage = {
    systemMs: (nextResourceUsage.systemCPUTime - resourceUsage.systemCPUTime) / 1000,
    userMs: (nextResourceUsage.userCPUTime - resourceUsage.userCPUTime) / 1000,
  };

  eventLoopUsage = performance.eventLoopUtilization();
  resourceUsage = nextResourceUsage;
  h.reset();
  if (p99 > 100) {
    logger.warn("Event loop p99", {
      cpuUsage,
      eventLoopUtilization: {
        activeMs: nextEventLoopUsage.active,
        idleMs: nextEventLoopUsage.idle,
        utilization: nextEventLoopUsage.utilization,
      },
      memoryUsage: {
        externalMb: memoryUsage.external / 1024 / 1024,
        heapTotalMb: memoryUsage.heapTotal / 1024 / 1024,
        heapUsedMb: memoryUsage.heapUsed / 1024 / 1024,
        rssMb: memoryUsage.rss / 1024 / 1024,
      },
      p99Ms: p99,
    });
  }
}, 2000);

main();
