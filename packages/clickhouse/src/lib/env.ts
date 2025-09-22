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
    CLICKHOUSE_URL: z.url(),
    CLICKHOUSE_USER: z.string(),
    CLICKHOUSE_PASSWORD: z.string(),
    CLICKHOUSE_DB: z.string(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  onValidationError: (error) => {
    console.error(error);
    throw "Invalid environment variables in clickhouse";
  },
  onInvalidAccess(variable) {
    console.error(`Invalid access to ${variable}`);
    throw "Invalid environment variables in clickhouse";
  },
});
