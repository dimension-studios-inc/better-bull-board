import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    REDIS_HOST: z.string(),
    REDIS_PORT: z
      .string()
      .optional()
      .transform((value) => (value ? parseInt(value, 10) : undefined)),
    REDIS_USERNAME: z.string().optional(),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_USE_TLS: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
    REDIS_MAX_RETRIES_PER_REQUEST: z
      .string()
      .nullish()
      .transform((value) =>
        value !== null && value !== undefined ? (value === "null" ? null : parseInt(value, 10)) : value,
      ),
    ADMIN_EMAIL: z.email(),
    ADMIN_PASSWORD: z.string().min(1),
    JWT_SECRET: z.string().min(1),
    WEBSOCKET_URL: z.url(), // Not in public otherwise it will be bring in the built app
  },
  // Leave client empty because we don't want to include any var in the built app for public use
  client: {},
  experimental__runtimeEnv: {},
});
