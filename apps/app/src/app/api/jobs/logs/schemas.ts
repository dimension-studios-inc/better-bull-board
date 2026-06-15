import { listJobLogsInputSchema, listJobLogsOutputSchema } from "@better-bull-board/core/job-schemas";
import { registerApiRoute } from "~/lib/utils/client";

export const getJobLogsApiRoute = registerApiRoute({
  route: "/api/jobs/logs",
  method: "POST",
  inputSchema: listJobLogsInputSchema,
  outputSchema: listJobLogsOutputSchema,
});
