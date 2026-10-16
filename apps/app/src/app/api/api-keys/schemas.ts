import { MCP_READ_SCOPE, MCP_WRITE_SCOPE } from "@better-bull-board/mcp/scopes"
import { z } from "zod"

import { registerApiRoute } from "~/lib/utils/client"

const apiKeyScopeSchema = z.enum([MCP_READ_SCOPE, `${MCP_READ_SCOPE} ${MCP_WRITE_SCOPE}`])

export type ApiKeyScope = z.infer<typeof apiKeyScopeSchema>

const apiKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  keyPrefix: z.string(),
  scope: z.string(),
  createdAt: z.coerce.date(),
  lastUsedAt: z.coerce.date().nullable(),
  revokedAt: z.coerce.date().nullable(),
})

export const listApiKeysApiRoute = registerApiRoute({
  route: "/api/api-keys",
  method: "GET",
  outputSchema: z.object({ apiKeys: z.array(apiKeySchema) }),
})

export const createApiKeyApiRoute = registerApiRoute({
  route: "/api/api-keys",
  method: "POST",
  inputSchema: z.object({
    name: z.string().trim().min(1).max(100),
    scope: apiKeyScopeSchema,
  }),
  outputSchema: z.object({ apiKey: apiKeySchema, key: z.string() }),
})
