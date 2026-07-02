import { sql } from "drizzle-orm";
import { bigint, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const dashboardQueueHourlyStatsTable = pgTable(
  "dashboard_queue_hourly_stats",
  {
    bucketStart: timestamp("bucket_start", { precision: 3, mode: "date" }).notNull(),
    queue: text("queue").notNull(),
    totalRuns: bigint("total_runs", { mode: "number" }).notNull().default(0),
    completedRuns: bigint("completed_runs", { mode: "number" }).notNull().default(0),
    failedRuns: bigint("failed_runs", { mode: "number" }).notNull().default(0),
    activeRuns: bigint("active_runs", { mode: "number" }).notNull().default(0),
    waitingRuns: bigint("waiting_runs", { mode: "number" }).notNull().default(0),
    durationTotalMs: bigint("duration_total_ms", { mode: "number" }).notNull().default(0),
    durationCount: bigint("duration_count", { mode: "number" }).notNull().default(0),
    durationMinMs: integer("duration_min_ms"),
    durationMaxMs: integer("duration_max_ms"),
    pressureTotalMs: bigint("pressure_total_ms", { mode: "number" }).notNull().default(0),
    pressureCount: bigint("pressure_count", { mode: "number" }).notNull().default(0),
    updatedAt: timestamp("updated_at", { precision: 3, mode: "date" }).notNull().default(sql`now()`),
  },
  (t) => [primaryKey({ name: "pk_dashboard_queue_hourly_stats", columns: [t.bucketStart, t.queue] })],
);
