import { logger } from "@rharkor/logger";
import { handleChannel } from "./channels";
import { redis } from "./lib/redis";
import { clearData } from "./repeats/clear-data";
import { autoIngestQueues } from "./repeats/queues";
import { stopStalledRuns } from "./repeats/stalled";

const listenToEvents = async () => {
  const subscriber = redis.duplicate();
  await subscriber.connect().catch(() => {});

  subscriber.psubscribe("bbb:worker:*", (error) => {
    if (error) throw error;
    logger.log("📥 Ingesting data from Redis");
  });
  subscriber.on("pmessage", handleChannel);
};

const main = async () => {
  await logger.init();

  //! Do not await
  listenToEvents();
  clearData();
  autoIngestQueues();
  stopStalledRuns();
};

main();
