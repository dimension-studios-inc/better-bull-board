import { z } from "zod"

import { registerApiRoute } from "~/lib/utils/client"

export const revokeApiKeyApiRoute = registerApiRoute({
  route: (input) => `/api/api-keys/${input.id}/revoke`,
  method: "POST",
  urlSchema: z.object({ id: z.uuid() }),
  outputSchema: z.object({ success: z.boolean() }),
})
