import z from "zod";
import { registerApiRoute } from "~/lib/utils/client";

export const getDashboardSummaryInput = z.object({
  days: z.number().min(1).max(30),
});

export const dashboardEnhancedStatsOutput = z.object({
  runningTasks: z.number(),
  waitingInQueue: z.number(),
  successes: z.number(),
  failures: z.number(),
});

export const dashboardQueuePerformanceOutput = z.object({
  queue: z.string(),
  totalRuns: z.number(),
  successes: z.number(),
  failures: z.number(),
  errorRate: z.number(),
  avgDuration: z.number(),
  minDuration: z.number(),
  maxDuration: z.number(),
});

export const dashboardTopQueuesCountOutput = z.object({
  queue: z.string(),
  runCount: z.number(),
});

export const dashboardTopQueuesDurationOutput = z.object({
  queue: z.string(),
  totalDuration: z.number(),
});

export const dashboardRunGraphOutput = z.object({
  timestamp: z.string(),
  runCount: z.number(),
});

export const getDashboardSummaryOutput = z.object({
  enhancedStats: dashboardEnhancedStatsOutput,
  queuePerformance: z.array(dashboardQueuePerformanceOutput),
  topQueuesCount: z.array(dashboardTopQueuesCountOutput),
  topQueuesDuration: z.array(dashboardTopQueuesDurationOutput),
  runGraph: z.array(dashboardRunGraphOutput),
});

export const getDashboardSummaryApiRoute = registerApiRoute({
  route: "/api/dashboard/summary",
  method: "POST",
  inputSchema: getDashboardSummaryInput,
  outputSchema: getDashboardSummaryOutput,
});
