import z from "zod";
import { registerApiRoute } from "~/lib/utils/client";

export const getRunGraphInput = z.object({
  days: z.number().min(1).max(30),
});

export const getRunGraphOutput = z.array(
  z.object({
    timestamp: z.string(),
    runCount: z.number(),
  }),
);

export const getRunGraphApiRoute = registerApiRoute({
  route: "/api/dashboard/run-graph",
  method: "POST",
  inputSchema: getRunGraphInput,
  outputSchema: getRunGraphOutput,
});