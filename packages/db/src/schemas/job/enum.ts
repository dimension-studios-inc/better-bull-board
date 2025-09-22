import { pgEnum } from "drizzle-orm/pg-core";

export const jobStatusEnum = pgEnum("job_status", [
  "waiting",
  "active",
  "completed",
  "failed",
  "delayed",
  "paused",
  "stalled",
  "discarded",
  "waiting-children",
]);

export const logLevelEnum = pgEnum("log_level", [
  "log",
  "debug",
  "info",
  "warn",
  "error",
]);
