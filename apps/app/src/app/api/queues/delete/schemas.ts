import { mutationResultSchema, queueMutationInputSchema } from "@better-bull-board/core/mutation-schemas";
import { registerApiRoute } from "~/lib/utils/client";

export const deleteQueueApiRoute = registerApiRoute({
  route: "/api/queues/delete",
  method: "POST",
  inputSchema: queueMutationInputSchema,
  outputSchema: mutationResultSchema,
});
