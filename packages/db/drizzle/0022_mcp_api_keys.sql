CREATE TABLE IF NOT EXISTS "mcp_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"scope" text DEFAULT 'bbb:read' NOT NULL,
	"created_at" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"last_used_at" timestamp (3),
	"revoked_at" timestamp (3)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ux_mcp_api_keys_key_hash" ON "mcp_api_keys" USING btree ("key_hash");
