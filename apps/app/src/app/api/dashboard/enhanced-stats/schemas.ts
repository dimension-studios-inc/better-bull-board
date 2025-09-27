import z from "zod";
import { registerApiRoute } from "~/lib/utils/client";

export const getEnhancedStatsInput = z.object({
  days: z.number().min(1).max(30),
});

export const getEnhancedStatsOutput = z.object({
  runningTasks: z.number(),
  waitingInQueue: z.number(),
  successes: z.number(),
  failures: z.number(),
});

export const getEnhancedStatsApiRoute = registerApiRoute({
  route: "/api/dashboard/enhanced-stats",
  method: "POST",
  inputSchema: getEnhancedStatsInput,
  outputSchema: getEnhancedStatsOutput,
});