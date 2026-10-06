import { listSchedulersInputSchema, listSchedulersOutputSchema } from "@better-bull-board/core/scheduler-schemas"
import { registerApiRoute } from "~/lib/utils/client"

export const getSchedulersTableApiRoute = registerApiRoute({
  route: "/api/schedulers/table",
  method: "POST",
  inputSchema: listSchedulersInputSchema,
  outputSchema: listSchedulersOutputSchema,
})
