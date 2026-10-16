import { HttpError } from "@better-bull-board/core/errors"
import { mcpApiKeysTable } from "@better-bull-board/db"
import { db } from "@better-bull-board/db/server"
import { and, eq, isNull } from "drizzle-orm"
import { z } from "zod"

import { createAuthenticatedApiRoute } from "~/lib/utils/server"

import { revokeApiKeyApiRoute } from "./schemas"

export const POST = createAuthenticatedApiRoute({
  apiRoute: revokeApiKeyApiRoute,
  async handler(_input, _req, ctx) {
    const { id } = await ctx.params
    const parsedId = z.uuid().safeParse(id)
    if (!parsedId.success) {
      throw new HttpError("Invalid API key id", 400)
    }

    const [revoked] = await db
      .update(mcpApiKeysTable)
      .set({ revokedAt: new Date() })
      .where(and(eq(mcpApiKeysTable.id, parsedId.data), isNull(mcpApiKeysTable.revokedAt)))
      .returning({ id: mcpApiKeysTable.id })

    if (!revoked) {
      throw new HttpError("API key not found or already revoked", 404)
    }

    return { success: true }
  },
})
