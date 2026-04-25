ALTER TYPE "public"."job_status" ADD VALUE IF NOT EXISTS 'delayed';--> statement-breakpoint
ALTER TYPE "public"."job_status" ADD VALUE IF NOT EXISTS 'prioritized';--> statement-breakpoint
ALTER TYPE "public"."job_status" ADD VALUE IF NOT EXISTS 'waiting-children';--> statement-breakpoint
ALTER TYPE "public"."job_status" ADD VALUE IF NOT EXISTS 'unknown';--> statement-breakpoint
DROP INDEX IF EXISTS "ux_job_runs_jobid_enqueuedat";--> statement-breakpoint
CREATE UNIQUE INDEX "ux_job_runs_queue_jobid_enqueuedat" ON "job_runs" USING btree ("queue","job_id","enqueued_at");
