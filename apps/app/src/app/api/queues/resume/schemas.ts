import { mutationResultSchema, queueMutationInputSchema } from "@better-bull-board/core/mutation-schemas";
import { registerApiRoute } from "~/lib/utils/client";

export const resumeQueueApiRoute = registerApiRoute({
  route: "/api/queues/resume",
  method: "POST",
  inputSchema: queueMutationInputSchema,
  outputSchema: mutationResultSchema,
});
