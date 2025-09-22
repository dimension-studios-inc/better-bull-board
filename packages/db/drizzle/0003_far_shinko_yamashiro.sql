DROP INDEX "ux_job_runs_jobid_attempt";--> statement-breakpoint
CREATE UNIQUE INDEX "ux_job_runs_jobid" ON "job_runs" USING btree ("job_id");