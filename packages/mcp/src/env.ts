import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BBB_MCP_HOST: z.string().default("127.0.0.1"),
    BBB_MCP_PORT: z
      .string()
      .default("3333")
      .transform((value) => Number.parseInt(value, 10))
      .pipe(z.number().int().min(1).max(65535)),
    BBB_MCP_TOKEN: z.string().min(32, "BBB_MCP_TOKEN must be at least 32 characters").optional(),
    REDIS_HOST: z.string().default("127.0.0.1"),
    REDIS_PORT: z
      .string()
      .default("6379")
      .transform((value) => Number.parseInt(value, 10))
      .pipe(z.number().int().min(1).max(65535)),
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
        value !== null && value !== undefined ? (value === "null" ? null : Number.parseInt(value, 10)) : value,
      ),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
