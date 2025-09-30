CREATE TABLE "worker_stats" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"worker_id" text NOT NULL,
	"memory_used" integer DEFAULT 0 NOT NULL,
	"memory_max" integer DEFAULT 0 NOT NULL,
	"memory_usage_percent" real GENERATED ALWAYS AS (CASE WHEN memory_max > 0 THEN (memory_used::real / memory_max::real) * 100 ELSE 0 END) STORED,
	"cpu_used" real DEFAULT 0 NOT NULL,
	"cpu_max" real DEFAULT 100 NOT NULL,
	"cpu_usage_percent" real GENERATED ALWAYS AS (CASE WHEN cpu_max > 0 THEN (cpu_used / cpu_max) * 100 ELSE 0 END) STORED,
	"recorded_at" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workers" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"worker_id" text NOT NULL,
	"queue_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"hostname" text,
	"pid" integer,
	"created_at" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"last_seen_at" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"inactive_since" timestamp (3),
	CONSTRAINT "workers_worker_id_unique" UNIQUE("worker_id")
);
--> statement-breakpoint
ALTER TABLE "worker_stats" ADD CONSTRAINT "worker_stats_worker_id_workers_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("worker_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_worker_stats_worker_id" ON "worker_stats" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "ix_worker_stats_recorded_at" ON "worker_stats" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "ix_worker_stats_worker_recorded" ON "worker_stats" USING btree ("worker_id","recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ix_workers_worker_id" ON "workers" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "ix_workers_queue_name" ON "workers" USING btree ("queue_name");--> statement-breakpoint
CREATE INDEX "ix_workers_is_active" ON "workers" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "ix_workers_last_seen_at" ON "workers" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "ix_workers_inactive_since" ON "workers" USING btree ("inactive_since");