import { jobMutationInputSchema, mutationResultSchema } from "@better-bull-board/core/mutation-schemas";
import { registerApiRoute } from "~/lib/utils/client";

export const cancelJobApiRoute = registerApiRoute({
  route: "/api/jobs/cancel",
  method: "POST",
  inputSchema: jobMutationInputSchema,
  outputSchema: mutationResultSchema,
});
