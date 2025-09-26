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
        value !== null && value !== undefined
          ? value === "null"
            ? null
            : parseInt(value, 10)
          : value,
      ),
    ADMIN_EMAIL: z.email(),
    ADMIN_PASSWORD: z.string().min(1),
    JWT_SECRET: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.url(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
});
