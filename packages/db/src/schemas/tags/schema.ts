import { sql } from "drizzle-orm";
import { index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const jobTagsTable = pgTable(
  "job_tags",
  {
    tag: text("tag").notNull(),
    tagLower: text("tag_lower").notNull(),
    lastSeenAt: timestamp("last_seen_at", { precision: 3, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { precision: 3, mode: "date" }).notNull().default(sql`now()`),
  },
  (t) => [
    primaryKey({ name: "pk_job_tags", columns: [t.tag] }),
    index("ix_job_tags_tag_lower_pattern").using("btree", sql`${t.tagLower} text_pattern_ops`),
    index("ix_job_tags_tag_lower_trgm").using("gin", sql`${t.tagLower} gin_trgm_ops`),
  ],
);

export const jobTagsInsertSchema = createInsertSchema(jobTagsTable);
export const jobTagsSelectSchema = createSelectSchema(jobTagsTable);
