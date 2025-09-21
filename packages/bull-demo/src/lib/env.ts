/* eslint-disable no-process-env */

import { createEnv } from "@t3-oss/env-core";
import { z } from "zod/v4";

export const env = createEnv({
  server: {
    ENV: z.enum([
      "development",
      "staging",
      "preproduction",
      "production",
      "test",
    ]),
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
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  onValidationError: (error) => {
    console.error(error);
    throw "Invalid environment variables in template";
  },
  onInvalidAccess(variable) {
    console.error(`Invalid access to ${variable}`);
    throw "Invalid environment variables in template";
  },
});
