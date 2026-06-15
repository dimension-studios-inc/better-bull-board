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

redis.on("error", (error: Error) => {
  console.error("Redis connection error", {
    message: error.message,
    stack: error.stack,
  });
});
