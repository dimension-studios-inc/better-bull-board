CREATE TABLE IF NOT EXISTS "job_log_buffer" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"queue" text NOT NULL,
	"job_id" text NOT NULL,
	"job_timestamp" timestamp (3) NOT NULL,
	"log_timestamp" timestamp (3) NOT NULL,
	"log_seq" integer DEFAULT 0 NOT NULL,
	"level" "log_level" DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ux_job_log_buffer_identity" ON "job_log_buffer" USING btree ("queue","job_id","job_timestamp","log_timestamp","log_seq");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_job_log_buffer_created_at" ON "job_log_buffer" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_job_log_buffer_job" ON "job_log_buffer" USING btree ("queue","job_id","job_timestamp");
