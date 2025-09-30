import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const workersTable = pgTable(
  "workers",
  {
    id: uuid().primaryKey().notNull().default(sql`uuid_generate_v7()`),
    workerId: text("worker_id").notNull().unique(), // BullMQ worker id
    queueName: text("queue_name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    
    // Worker metadata
    hostname: text("hostname"),
    pid: integer("pid"),
    
    // Timestamps
    createdAt: timestamp("created_at", { precision: 3, mode: "date" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    lastSeenAt: timestamp("last_seen_at", { precision: 3, mode: "date" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    inactiveSince: timestamp("inactive_since", { precision: 3, mode: "date" }),
  },
  (t) => [
    uniqueIndex("ix_workers_worker_id").on(t.workerId),
    index("ix_workers_queue_name").on(t.queueName),
    index("ix_workers_is_active").on(t.isActive),
    index("ix_workers_last_seen_at").on(t.lastSeenAt),
    index("ix_workers_inactive_since").on(t.inactiveSince),
  ],
);

export const workersInsertSchema = createInsertSchema(workersTable);
export const workersSelectSchema = createSelectSchema(workersTable);

// Worker statistics table - stores resource usage metrics
export const workerStatsTable = pgTable(
  "worker_stats",
  {
    id: uuid().primaryKey().notNull().default(sql`uuid_generate_v7()`),
    workerId: text("worker_id")
      .notNull()
      .references(() => workersTable.workerId, { onDelete: "cascade" }),
    
    // Memory usage (in bytes)
    memoryUsed: integer("memory_used").notNull().default(0),
    memoryMax: integer("memory_max").notNull().default(0),
    memoryUsagePercent: real("memory_usage_percent").generatedAlwaysAs(
      sql`CASE WHEN memory_max > 0 THEN (memory_used::real / memory_max::real) * 100 ELSE 0 END`,
    ),
    
    // CPU usage (percentage)
    cpuUsed: real("cpu_used").notNull().default(0),
    cpuMax: real("cpu_max").notNull().default(100), // Usually 100% but could be different in containers
    cpuUsagePercent: real("cpu_usage_percent").generatedAlwaysAs(
      sql`CASE WHEN cpu_max > 0 THEN (cpu_used / cpu_max) * 100 ELSE 0 END`,
    ),
    
    // Timestamp
    recordedAt: timestamp("recorded_at", { precision: 3, mode: "date" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => [
    index("ix_worker_stats_worker_id").on(t.workerId),
    index("ix_worker_stats_recorded_at").on(t.recordedAt),
    index("ix_worker_stats_worker_recorded").on(t.workerId, t.recordedAt),
  ],
);

export const workerStatsInsertSchema = createInsertSchema(workerStatsTable);
export const workerStatsSelectSchema = createSelectSchema(workerStatsTable);