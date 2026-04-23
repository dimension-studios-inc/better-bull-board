CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.job_runs_tags_search_text(tags text[])
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
RETURNS NULL ON NULL INPUT
AS $$ SELECT array_to_string(tags, ' ') $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_job_runs_tags_text_trgm" ON "job_runs" USING gin ((public.job_runs_tags_search_text("tags")) gin_trgm_ops) WHERE cardinality("job_runs"."tags") > 0;
