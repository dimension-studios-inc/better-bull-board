import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const mcpOAuthClientsTable = pgTable(
  "mcp_oauth_clients",
  {
    id: uuid().primaryKey().notNull().default(sql`uuid_generate_v7()`),
    clientId: text("client_id").notNull(),
    clientSecretHash: text("client_secret_hash"),
    clientName: text("client_name").notNull(),
    redirectUris: text("redirect_uris").array().notNull(),
    grantTypes: text("grant_types").array().notNull(),
    responseTypes: text("response_types").array().notNull(),
    tokenEndpointAuthMethod: text("token_endpoint_auth_method").notNull().default("none"),
    scope: text("scope").notNull().default("bbb:read"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { precision: 3, mode: "date" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: timestamp("updated_at", { precision: 3, mode: "date" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (t) => [uniqueIndex("ux_mcp_oauth_clients_client_id").on(t.clientId)],
);

export const mcpOAuthAuthorizationCodesTable = pgTable(
  "mcp_oauth_authorization_codes",
  {
    id: uuid().primaryKey().notNull().default(sql`uuid_generate_v7()`),
    codeHash: text("code_hash").notNull(),
    clientId: text("client_id").notNull(),
    redirectUri: text("redirect_uri").notNull(),
    scope: text("scope").notNull().default("bbb:read"),
    codeChallenge: text("code_challenge").notNull(),
    codeChallengeMethod: text("code_challenge_method").notNull(),
    resource: text("resource").notNull(),
    subject: text("subject").notNull(),
    expiresAt: timestamp("expires_at", { precision: 3, mode: "date" }).notNull(),
    usedAt: timestamp("used_at", { precision: 3, mode: "date" }),
    createdAt: timestamp("created_at", { precision: 3, mode: "date" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (t) => [
    uniqueIndex("ux_mcp_oauth_authorization_codes_code_hash").on(t.codeHash),
    index("ix_mcp_oauth_authorization_codes_client_id").on(t.clientId),
  ],
);

export const mcpOAuthTokensTable = pgTable(
  "mcp_oauth_tokens",
  {
    id: uuid().primaryKey().notNull().default(sql`uuid_generate_v7()`),
    accessTokenHash: text("access_token_hash").notNull(),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    clientId: text("client_id").notNull(),
    subject: text("subject").notNull(),
    scope: text("scope").notNull().default("bbb:read"),
    resource: text("resource").notNull(),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { precision: 3, mode: "date" }).notNull(),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { precision: 3, mode: "date" }).notNull(),
    revokedAt: timestamp("revoked_at", { precision: 3, mode: "date" }),
    lastUsedAt: timestamp("last_used_at", { precision: 3, mode: "date" }),
    createdAt: timestamp("created_at", { precision: 3, mode: "date" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    rotatedAt: timestamp("rotated_at", { precision: 3, mode: "date" }),
    replacedByTokenId: uuid("replaced_by_token_id"),
  },
  (t) => [
    uniqueIndex("ux_mcp_oauth_tokens_access_token_hash").on(t.accessTokenHash),
    uniqueIndex("ux_mcp_oauth_tokens_refresh_token_hash").on(t.refreshTokenHash),
    index("ix_mcp_oauth_tokens_client_id").on(t.clientId),
  ],
);

export const mcpOAuthClientsInsertSchema = createInsertSchema(mcpOAuthClientsTable);
export const mcpOAuthClientsSelectSchema = createSelectSchema(mcpOAuthClientsTable);
export const mcpOAuthAuthorizationCodesInsertSchema = createInsertSchema(mcpOAuthAuthorizationCodesTable);
export const mcpOAuthAuthorizationCodesSelectSchema = createSelectSchema(mcpOAuthAuthorizationCodesTable);
export const mcpOAuthTokensInsertSchema = createInsertSchema(mcpOAuthTokensTable);
export const mcpOAuthTokensSelectSchema = createSelectSchema(mcpOAuthTokensTable);
