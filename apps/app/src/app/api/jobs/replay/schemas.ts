import { jobMutationInputSchema, mutationResultSchema } from "@better-bull-board/core/mutation-schemas";
import { registerApiRoute } from "~/lib/utils/client";

export const replayJobApiRoute = registerApiRoute({
  route: "/api/jobs/replay",
  method: "POST",
  inputSchema: jobMutationInputSchema,
  outputSchema: mutationResultSchema,
});
