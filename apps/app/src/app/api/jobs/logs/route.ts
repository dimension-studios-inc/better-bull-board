import { searchJobLogs } from "@better-bull-board/clickhouse";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getJobLogsApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getJobLogsApiRoute,
  async handler(input) {
    const { id, level, messageContains, limit = 100, offset = 0 } = input;

    const { logs, total } = await searchJobLogs({
      id,
      level,
      messageContains,
      limit,
      offset,
      direction: "asc",
    });

    return {
      logs,
      total,
    };
  },
});
