import { jobLogDataSchema } from "@better-bull-board/clickhouse/schemas";
import { logLevelEnum } from "@better-bull-board/db";
import z from "zod";
import { registerApiRoute } from "~/lib/utils/client";

export const getJobLogsInput = z.object({
  jobRunId: z.string(),
  level: z.enum(logLevelEnum.enumValues).optional(),
  messageContains: z.string().optional(),
  limit: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
});

export const getJobLogsOutput = z.object({
  logs: z.array(
    jobLogDataSchema.extend({
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
