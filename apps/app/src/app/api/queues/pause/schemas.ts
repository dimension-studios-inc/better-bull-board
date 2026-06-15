import { mutationResultSchema, queueMutationInputSchema } from "@better-bull-board/core/mutation-schemas";
import { registerApiRoute } from "~/lib/utils/client";

export const pauseQueueApiRoute = registerApiRoute({
  route: "/api/queues/pause",
  method: "POST",
  inputSchema: queueMutationInputSchema,
  outputSchema: mutationResultSchema,
});
