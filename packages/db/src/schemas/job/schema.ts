import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { jobStatusEnum, logLevelEnum } from "./enum";

// One row per *run attempt* (a job may have several attempts)
export const jobRuns = pgTable(
  "job_runs",
  {
    id: uuid().primaryKey().notNull().default(sql`uuid_generate_v7()`),
    jobId: text("job_id").notNull(), // BullMQ job id (string)
    queue: text("queue").notNull(),
    name: text("name"), // job name (optional)
    status: jobStatusEnum("status").notNull(),

    attempt: smallint("attempt").notNull().default(0),
    maxAttempts: smallint("max_attempts").notNull().default(1),
    priority: integer("priority"),
    delayMs: integer("delay_ms").notNull().default(0),
    backoff: jsonb("backoff"), // { type, delay, strategy... }

    repeatJobKey: text("repeat_job_key"),
    parentJobId: text("parent_job_id"),
    workerId: text("worker_id"),

    tags: text("tags").array().default(sql`ARRAY[]::text[]`),

    data: jsonb("data"), // trimmed payload (safe to store)
    result: jsonb("result"),

    errorType: text("error_type"),
    errorMessage: text("error_message"),
    errorStack: text("error_stack"),

    createdAt: timestamp("created_at", { precision: 3, mode: "date" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    enqueuedAt: timestamp("enqueued_at", { precision: 3, mode: "date" }),
    startedAt: timestamp("started_at", { precision: 3, mode: "date" }),
    finishedAt: timestamp("finished_at", { precision: 3, mode: "date" }),

    durationMs: integer("duration_ms").generatedAlwaysAs(
      sql`EXTRACT(EPOCH FROM (finished_at - started_at)) * 1000`,
    ),
  },
  (t) => [
    uniqueIndex("ux_job_runs_jobid_attempt").on(t.jobId, t.attempt),
    index("ix_job_runs_queue_created_at").on(t.queue, t.createdAt),
    index("ix_job_runs_created_at").on(t.createdAt),
    index("ix_job_runs_job").on(t.jobId),
    index("ix_job_runs_status_created_at").on(t.status, t.createdAt),
    index("ix_job_runs_repeat_key").on(t.repeatJobKey),
    index("ix_job_runs_tags_gin").using("gin", t.tags),
    index("ix_job_runs_data_gin").using("gin", t.data),
  ],
);

// Many rows per run (append-only)
export const jobLogs = pgTable(
  "job_logs",
  {
    id: uuid().primaryKey().notNull().default(sql`uuid_generate_v7()`),
    jobRunId: uuid("job_run_id")
      .notNull()
      .references(() => jobRuns.id, { onDelete: "cascade" }),

    level: logLevelEnum("level").notNull().default("info"),
    message: text("message").notNull(),

    ts: timestamp("ts", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    index("ix_job_logs_job_run_ts").on(t.jobRunId, t.ts),
    index("ix_job_logs_ts_brin").using("brin", t.ts), // cheap time-range scans
  ],
);
