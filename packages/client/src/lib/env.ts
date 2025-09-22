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
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  onValidationError: (error) => {
    console.error(error);
    throw "Invalid environment variables in client";
  },
  onInvalidAccess(variable) {
    console.error(`Invalid access to ${variable}`);
    throw "Invalid environment variables in client";
  },
});
