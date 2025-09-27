import { searchJobLogs } from "@better-bull-board/clickhouse";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getJobLogsApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getJobLogsApiRoute,
  async handler(input) {
    const { id, level, messageContains, limit = 100, offset = 0 } = input;

    const logs = await searchJobLogs({
      id,
      level,
      messageContains,
      limit,
      offset,
    });

    // For now, we'll return the count of logs as total
    // In a real scenario, you might want to do a separate count query
    const total = logs.length;

    return {
      logs,
      total,
    };
  },
});
