import { logLevelEnum } from "@better-bull-board/db";
import z from "zod";
import { registerApiRoute } from "~/lib/utils/client";

export const getJobLogsInput = z.object({
  id: z.string(),
  level: z.enum(logLevelEnum.enumValues).optional(),
  messageContains: z.string().optional(),
  limit: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
});

export const getJobLogsOutput = z.object({
  logs: z.array(
    z.object({
      id: z.string(),
      jobRunId: z.string(),
      level: z.string(),
      message: z.string(),
      logSeq: z.number(),
      ts: z.number(),
    }),
  ),
  total: z.number(),
});

export const getJobLogsApiRoute = registerApiRoute({
  route: "/api/jobs/logs",
  method: "POST",
  inputSchema: getJobLogsInput,
  outputSchema: getJobLogsOutput,
});
