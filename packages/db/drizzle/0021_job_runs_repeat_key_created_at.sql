CREATE INDEX IF NOT EXISTS "ix_job_runs_repeat_key_created_at" ON "job_runs" USING btree ("repeat_job_key","created_at") WHERE "job_runs"."repeat_job_key" IS NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "ix_job_runs_repeat_key";
