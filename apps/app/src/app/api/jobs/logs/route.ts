import { listJobLogs } from "@better-bull-board/core";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getJobLogsApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getJobLogsApiRoute,
  handler: listJobLogs,
});
