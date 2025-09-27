DROP INDEX "ux_job_runs_jobid";--> statement-breakpoint
CREATE UNIQUE INDEX "ux_job_runs_jobid_enqueuedat" ON "job_runs" USING btree ("job_id","enqueued_at");