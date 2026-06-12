import { listJobLogsInputSchema, listJobLogsOutputSchema } from "@better-bull-board/core";
import { registerApiRoute } from "~/lib/utils/client";

export const getJobLogsInput = listJobLogsInputSchema;
export const getJobLogsOutput = listJobLogsOutputSchema;

export const getJobLogsApiRoute = registerApiRoute({
  route: "/api/jobs/logs",
  method: "POST",
  inputSchema: getJobLogsInput,
  outputSchema: getJobLogsOutput,
});
