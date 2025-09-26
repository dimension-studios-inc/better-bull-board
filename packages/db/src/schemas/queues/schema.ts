import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";

export const queuesTable = pgTable(
  "queues",
  {
    id: uuid().primaryKey().notNull().default(sql`uuid_generate_v7()`),
    name: text("name").notNull(),
    defaultJobOptions: jsonb("default_job_options").default({}),
    isPaused: boolean("is_paused").notNull().default(false),
    createdAt: timestamp("created_at", { precision: 3, mode: "date" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => [uniqueIndex("ix_queues_name").on(t.name)],
);

export const queuesSelectSchema = createSelectSchema(queuesTable);

export const jobSchedulersTable = pgTable(
  "job_schedulers",
  {
    id: uuid().primaryKey().notNull().default(sql`uuid_generate_v7()`),
    queueId: uuid("queue_id")
      .notNull()
      .references(() => queuesTable.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    limit: integer("limit"),
    endDate: timestamp("end_date"),
    tz: text("tz"),
    pattern: text("pattern"),
    every: integer("every"),
    template: jsonb("template"),
    createdAt: timestamp("created_at", { precision: 3, mode: "date" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => [uniqueIndex("ix_job_schedulers_key").on(t.key)],
);
