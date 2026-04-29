/* eslint-disable no-process-env */

import { createEnv } from "@t3-oss/env-core";
import { z } from "zod/v4";

export const env = createEnv({
  server: {
    ENV: z.enum(["development", "staging", "preproduction", "production", "test"]),
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
    AUTO_DELETE_POSTGRES_DATA: z
      .string()
      .optional()
      .transform((value) => (value ? parseInt(value, 10) : undefined)),
    WEBSOCKET_PORT: z.string().transform((value) => parseInt(value, 10)),
    JOB_SYNC_STREAM_KEY: z.string().default("bbb:worker:jobs"),
    JOB_SYNC_CONSUMER_GROUP: z.string().default("bbb-ingest"),
    JOB_SYNC_BATCH_SIZE: z
      .string()
      .optional()
      .transform((value) => (value ? parseInt(value, 10) : 300)),
    JOB_SYNC_PENDING_IDLE_MS: z
      .string()
      .optional()
      .transform((value) => (value ? parseInt(value, 10) : 30_000)),
    JOB_LOG_SYNC_STREAM_KEY: z.string().default("bbb:worker:job-logs"),
    JOB_LOG_SYNC_CONSUMER_GROUP: z.string().default("bbb-ingest-logs"),
    JOB_LOG_SYNC_BATCH_SIZE: z
      .string()
      .optional()
      .transform((value) => (value ? parseInt(value, 10) : 500)),
    JOB_LOG_SYNC_PENDING_IDLE_MS: z
      .string()
      .optional()
      .transform((value) => (value ? parseInt(value, 10) : 30_000)),
    JOB_LOG_BUFFER_FLUSH_INTERVAL_MS: z
      .string()
      .optional()
      .transform((value) => (value ? parseInt(value, 10) : 10_000)),
    JOB_LOG_BUFFER_BATCH_SIZE: z
      .string()
      .optional()
      .transform((value) => (value ? parseInt(value, 10) : 1000)),
    JOB_LOG_BUFFER_ORPHAN_WARN_AFTER_MS: z
      .string()
      .optional()
      .transform((value) => (value ? parseInt(value, 10) : 3_600_000)),
    JOB_RECONCILE_INTERVAL_MS: z
      .string()
      .optional()
      .transform((value) => (value ? parseInt(value, 10) : 60_000)),
    JOB_RECONCILE_PAGE_SIZE: z
      .string()
      .optional()
      .transform((value) => (value ? parseInt(value, 10) : 500)),
    JOB_RECONCILE_MAX_QUEUES_PER_TICK: z
      .string()
      .optional()
      .transform((value) => (value ? parseInt(value, 10) : 25)),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  onValidationError: (error) => {
    console.error(error);
    throw "Invalid environment variables in ingest";
  },
  onInvalidAccess(variable) {
    console.error(`Invalid access to ${variable}`);
    throw "Invalid environment variables in ingest";
  },
});
