import { logger } from "@rharkor/logger";
import { handleChannel } from "./channels";
import { redis } from "./lib/redis";

const main = async () => {
  await logger.init();

  const subscriber = redis.duplicate();
  await subscriber.connect().catch(() => {});

  await subscriber.psubscribe("bbb:worker:*", (error) => {
    if (error) throw error;
    logger.info("Ingesting data from Redis");

    subscriber.on("pmessage", handleChannel);
  });
};

main();
