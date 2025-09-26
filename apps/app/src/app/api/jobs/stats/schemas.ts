import z from "zod";
import { registerApiRoute } from "~/lib/utils/client";

export const getJobsStatsInput = z.object({
  days: z.number().min(1).max(30),
});

export const getJobsStatsOutput = z.object({
  active: z.number(),
  completed: z.number(),
  failed: z.number(),
});

export const getJobsStatsApiRoute = registerApiRoute({
  route: "/api/jobs/stats",
  method: "POST",
  inputSchema: getJobsStatsInput,
  outputSchema: getJobsStatsOutput,
});
