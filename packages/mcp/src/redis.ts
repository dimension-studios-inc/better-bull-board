import Redis, { type RedisOptions } from "ioredis"

import { env } from "./env"

const options: RedisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  username: env.REDIS_USERNAME,
  password: env.REDIS_PASSWORD,
  tls: env.REDIS_USE_TLS ? {} : undefined,
  maxRetriesPerRequest: env.REDIS_MAX_RETRIES_PER_REQUEST,
  // Connect on the first command, not at import: `next build` imports the routes to collect page data
  lazyConnect: true,
}

export const redis = new Redis(options)

redis.on("error", (error: Error) => {
  console.error("Redis connection error", {
    message: error.message,
    stack: error.stack,
  })
})
