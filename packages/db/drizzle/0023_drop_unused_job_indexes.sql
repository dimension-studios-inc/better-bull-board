-- Never scanned: no query filters on job_runs.data, and nothing calls job_runs_tags_search_text().
DROP INDEX IF EXISTS "ix_job_runs_data_gin";
--> statement-breakpoint
DROP INDEX IF EXISTS "ix_job_runs_tags_text_trgm";
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.job_runs_tags_search_text(text[]);
--> statement-breakpoint
-- Prefixes of the keyset indexes (…, job_id, id), which serve the same lookups.
DROP INDEX IF EXISTS "ix_job_runs_queue_created_at";
--> statement-breakpoint
DROP INDEX IF EXISTS "ix_job_runs_created_at";
--> statement-breakpoint
DROP INDEX IF EXISTS "ix_job_runs_status_created_at";
--> statement-breakpoint
DROP INDEX IF EXISTS "ix_job_runs_status";
--> statement-breakpoint
-- Prefix of ux_job_logs_run_ts_seq (job_run_id, ts, log_seq).
DROP INDEX IF EXISTS "ix_job_logs_job_run_ts";
