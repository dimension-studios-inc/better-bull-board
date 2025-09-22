import { logger } from "@rharkor/logger";
import { handleChannel } from "./channels";
import { redis } from "./lib/redis";

const main = async () => {
  await logger.init();

  await redis.psubscribe("bbb:worker:*", (error) => {
    if (error) throw error;
    logger.info("Ingesting data from Redis");

    redis.on("pmessage", handleChannel);
  });
};

main();
