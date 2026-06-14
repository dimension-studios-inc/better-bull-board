CREATE INDEX IF NOT EXISTS "ix_job_runs_created_at_job_id_id" ON "job_runs" USING btree ("created_at","job_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_job_runs_queue_created_at_job_id_id" ON "job_runs" USING btree ("queue","created_at","job_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_job_runs_status_created_at_job_id_id" ON "job_runs" USING btree ("status","created_at","job_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_job_runs_queue_status_created_at_job_id_id" ON "job_runs" USING btree ("queue","status","created_at","job_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_job_runs_duration_created_at_job_id_id" ON "job_runs" USING btree (COALESCE("duration_ms", 0),"created_at","job_id","id");
