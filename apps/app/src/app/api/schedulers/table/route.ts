import { listSchedulers } from "@better-bull-board/core/schedulers"

import { createAuthenticatedApiRoute } from "~/lib/utils/server"

import { getSchedulersTableApiRoute } from "./schemas"

export const POST = createAuthenticatedApiRoute({
  apiRoute: getSchedulersTableApiRoute,
  handler: listSchedulers,
})
