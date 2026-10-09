import {
  listTopErrorsInputSchema,
  listTopErrorsOutputSchema,
} from "@better-bull-board/core/top-errors-schemas"

import { registerApiRoute } from "~/lib/utils/client"

export const getDashboardTopErrorsApiRoute = registerApiRoute({
  route: "/api/dashboard/top-errors",
  method: "POST",
  inputSchema: listTopErrorsInputSchema,
  outputSchema: listTopErrorsOutputSchema,
})
