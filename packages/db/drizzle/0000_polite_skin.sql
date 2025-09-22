-- Create pg_uuidv7 extension
CREATE EXTENSION IF NOT EXISTS pg_uuidv7;

-- Create pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE "public"."job_status" AS ENUM('waiting', 'active', 'completed', 'failed', 'delayed', 'paused', 'stalled', 'discarded', 'waiting-children');--> statement-breakpoint
CREATE TYPE "public"."log_level" AS ENUM('log', 'debug', 'info', 'warn', 'error');--> statement-breakpoint
CREATE TABLE "job_logs" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"job_run_id" uuid NOT NULL,
	"level" "log_level" DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"job_id" text NOT NULL,
	"queue" text NOT NULL,
	"name" text,
	"status" "job_status" NOT NULL,
	"attempt" smallint DEFAULT 0 NOT NULL,
	"max_attempts" smallint DEFAULT 1 NOT NULL,
	"priority" integer,
	"delay_ms" integer DEFAULT 0 NOT NULL,
	"backoff" jsonb,
	"repeat_job_key" text,
	"parent_job_id" text,
	"worker_id" text,
	"tags" text[] DEFAULT ARRAY[]::text[],
	"data" jsonb,
	"result" jsonb,
	"error_type" text,
	"error_message" text,
	"error_stack" text,
	"created_at" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"enqueued_at" timestamp (3),
	"started_at" timestamp (3),
	"finished_at" timestamp (3),
	"duration_ms" integer GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (finished_at - started_at)) * 1000) STORED
);
--> statement-breakpoint
ALTER TABLE "job_logs" ADD CONSTRAINT "job_logs_job_run_id_job_runs_id_fk" FOREIGN KEY ("job_run_id") REFERENCES "public"."job_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_job_logs_job_run_ts" ON "job_logs" USING btree ("job_run_id","ts");--> statement-breakpoint
CREATE INDEX "ix_job_logs_ts_brin" ON "job_logs" USING brin ("ts");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_job_runs_jobid_attempt" ON "job_runs" USING btree ("job_id","attempt");--> statement-breakpoint
CREATE INDEX "ix_job_runs_queue_created_at" ON "job_runs" USING btree ("queue","created_at");--> statement-breakpoint
CREATE INDEX "ix_job_runs_created_at" ON "job_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ix_job_runs_job" ON "job_runs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "ix_job_runs_status_created_at" ON "job_runs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "ix_job_runs_repeat_key" ON "job_runs" USING btree ("repeat_job_key");--> statement-breakpoint
CREATE INDEX "ix_job_runs_tags_gin" ON "job_runs" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "ix_job_runs_data_gin" ON "job_runs" USING gin ("data");