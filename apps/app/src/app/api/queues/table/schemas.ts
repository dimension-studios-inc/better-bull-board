import { listQueuesBaseInputSchema, listQueuesOutputSchema } from "@better-bull-board/core/queue-schemas";
import z from "zod";
import { registerApiRoute } from "~/lib/utils/client";

const getQueuesTableInput = listQueuesBaseInputSchema
  .omit({ pressureDateFrom: true, pressureDateTo: true })
  .extend({
    timePeriod: z.enum(["1", "3", "7", "30"]).optional().default("1"),
  })
  .superRefine((input, ctx) => {
    if (input.sortBy === "pressure" && input.cursor && input.cursor.pressure === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Pressure cursor is required when sorting by pressure",
        path: ["cursor", "pressure"],
      });
    }
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
