CREATE TABLE IF NOT EXISTS "mcp_oauth_clients" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"client_id" text NOT NULL,
	"client_secret_hash" text,
	"client_name" text NOT NULL,
	"redirect_uris" text[] NOT NULL,
	"grant_types" text[] NOT NULL,
	"response_types" text[] NOT NULL,
	"token_endpoint_auth_method" text DEFAULT 'none' NOT NULL,
	"scope" text DEFAULT 'bbb:read' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ux_mcp_oauth_clients_client_id" ON "mcp_oauth_clients" USING btree ("client_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mcp_oauth_authorization_codes" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"code_hash" text NOT NULL,
	"client_id" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"scope" text DEFAULT 'bbb:read' NOT NULL,
	"code_challenge" text NOT NULL,
	"code_challenge_method" text NOT NULL,
	"resource" text NOT NULL,
	"subject" text NOT NULL,
	"expires_at" timestamp (3) NOT NULL,
	"used_at" timestamp (3),
	"created_at" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ux_mcp_oauth_authorization_codes_code_hash" ON "mcp_oauth_authorization_codes" USING btree ("code_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_mcp_oauth_authorization_codes_client_id" ON "mcp_oauth_authorization_codes" USING btree ("client_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mcp_oauth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"access_token_hash" text NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"client_id" text NOT NULL,
	"subject" text NOT NULL,
	"scope" text DEFAULT 'bbb:read' NOT NULL,
	"resource" text NOT NULL,
	"access_token_expires_at" timestamp (3) NOT NULL,
	"refresh_token_expires_at" timestamp (3) NOT NULL,
	"revoked_at" timestamp (3),
	"last_used_at" timestamp (3),
	"created_at" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"rotated_at" timestamp (3),
	"replaced_by_token_id" uuid
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ux_mcp_oauth_tokens_access_token_hash" ON "mcp_oauth_tokens" USING btree ("access_token_hash");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ux_mcp_oauth_tokens_refresh_token_hash" ON "mcp_oauth_tokens" USING btree ("refresh_token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_mcp_oauth_tokens_client_id" ON "mcp_oauth_tokens" USING btree ("client_id");
