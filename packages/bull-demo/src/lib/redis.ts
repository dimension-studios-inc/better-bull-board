import { logger } from "@rharkor/logger";
import Redis, { type RedisOptions } from "ioredis";

import { env } from "./env";

const options: RedisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  username: env.REDIS_USERNAME,
  password: env.REDIS_PASSWORD,
  tls: env.REDIS_USE_TLS ? {} : undefined,
  maxRetriesPerRequest: env.REDIS_MAX_RETRIES_PER_REQUEST,
};

export const redis = new Redis(options);

redis.on("error", (err: Error) => {
  logger.error("Redis connection error", {
    message: err.message,
    stack: err.stack,
    address: (err as unknown as { address: string }).address,
    port: (err as unknown as { port: number }).port,
  });
  logger.trace("Redis connection error");
});
