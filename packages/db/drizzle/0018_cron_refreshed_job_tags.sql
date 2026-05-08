CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_tags" (
	"tag" text NOT NULL,
	"tag_lower" text NOT NULL,
	"last_seen_at" timestamp (3) NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "pk_job_tags" PRIMARY KEY("tag")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_job_tags_tag_lower_pattern" ON "job_tags" USING btree ("tag_lower" text_pattern_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_job_tags_tag_lower_trgm" ON "job_tags" USING gin ("tag_lower" gin_trgm_ops);
--> statement-breakpoint
INSERT INTO "job_tags" ("tag", "tag_lower", "last_seen_at", "updated_at")
SELECT
	unnested_tags.tag,
	lower(unnested_tags.tag),
	MAX("job_runs"."created_at")::timestamp,
	now()
FROM "job_runs"
CROSS JOIN LATERAL unnest("job_runs"."tags") AS unnested_tags(tag)
WHERE cardinality("job_runs"."tags") > 0
	AND unnested_tags.tag IS NOT NULL
	AND unnested_tags.tag <> ''
GROUP BY unnested_tags.tag
ON CONFLICT ("tag") DO UPDATE SET
	"tag_lower" = EXCLUDED."tag_lower",
	"last_seen_at" = GREATEST("job_tags"."last_seen_at", EXCLUDED."last_seen_at"),
	"updated_at" = now();
