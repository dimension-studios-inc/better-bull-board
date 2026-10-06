import { listTopErrors } from "@better-bull-board/core/top-errors"
import { getDashboardTopErrorsApiRoute } from "~/app/api/dashboard/top-errors/schemas"
import { createAuthenticatedApiRoute } from "~/lib/utils/server"

// Apart from the summary: grouping the error messages is slower and must not hold the rest of the dashboard
export const POST = createAuthenticatedApiRoute({
  apiRoute: getDashboardTopErrorsApiRoute,
  handler: listTopErrors,
})
