import { mcpApiKeysTable } from "@better-bull-board/db"
import { db } from "@better-bull-board/db/server"
import { desc } from "drizzle-orm"

import { generateApiKey } from "~/lib/mcp/oauth"
import { createAuthenticatedApiRoute } from "~/lib/utils/server"

import { createApiKeyApiRoute, listApiKeysApiRoute } from "./schemas"

// Never select key_hash: it stays server side
const apiKeyColumns = {
  id: mcpApiKeysTable.id,
  name: mcpApiKeysTable.name,
  keyPrefix: mcpApiKeysTable.keyPrefix,
  scope: mcpApiKeysTable.scope,
  createdAt: mcpApiKeysTable.createdAt,
  lastUsedAt: mcpApiKeysTable.lastUsedAt,
  revokedAt: mcpApiKeysTable.revokedAt,
}

export const GET = createAuthenticatedApiRoute({
  apiRoute: listApiKeysApiRoute,
  async handler() {
    const apiKeys = await db
      .select(apiKeyColumns)
      .from(mcpApiKeysTable)
      .orderBy(desc(mcpApiKeysTable.createdAt))
    return { apiKeys }
  },
})

export const POST = createAuthenticatedApiRoute({
  apiRoute: createApiKeyApiRoute,
  async handler(input) {
    const { key, keyHash, keyPrefix } = generateApiKey()
    const [apiKey] = await db
      .insert(mcpApiKeysTable)
      .values({ name: input.name, scope: input.scope, keyHash, keyPrefix })
      .returning(apiKeyColumns)

    if (!apiKey) {
      throw new Error("Failed to create API key")
    }

    // The only response that carries the plaintext key
    return { apiKey, key }
  },
})
