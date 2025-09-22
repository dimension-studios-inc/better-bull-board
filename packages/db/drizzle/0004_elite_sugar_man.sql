CREATE TABLE "job_schedulers" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"queue_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"iteration_count" integer,
	"limit" integer,
	"end_date" timestamp,
	"tz" text,
	"pattern" text,
	"every" integer,
	"next" timestamp (3),
	"offset" integer,
	"template" jsonb,
	"created_at" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "queues" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"name" text NOT NULL,
	"default_job_options" jsonb DEFAULT '{}'::jsonb,
	"is_paused" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_logs" ALTER COLUMN "ts" SET DATA TYPE timestamp (3);--> statement-breakpoint
ALTER TABLE "job_logs" ALTER COLUMN "ts" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "job_schedulers" ADD CONSTRAINT "job_schedulers_queue_id_queues_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."queues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ix_queues_name" ON "queues" USING btree ("name");