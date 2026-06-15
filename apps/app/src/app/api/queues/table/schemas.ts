import { listQueuesInputSchema, listQueuesOutputSchema } from "@better-bull-board/core/queue-schemas";
import z from "zod";
import { registerApiRoute } from "~/lib/utils/client";

const getQueuesTableInput = listQueuesInputSchema.extend({
  timePeriod: z.enum(["1", "3", "7", "30"]).optional().default("1"),
});

const getQueuesTableOutput = listQueuesOutputSchema.extend({
  queues: z.array(
    listQueuesOutputSchema.shape.queues.element.extend({
      pressure: z.number(),
      chartData: z.array(
        z.object({
          timestamp: z.string(),
          completed: z.number(),
          failed: z.number(),
        }),
      ),
    }),
  ),
});

export const getQueuesTableApiRoute = registerApiRoute({
  route: "/api/queues/table",
  method: "POST",
  inputSchema: getQueuesTableInput,
  outputSchema: getQueuesTableOutput,
});
