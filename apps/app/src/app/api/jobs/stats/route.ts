import { getJobStats } from "@better-bull-board/clickhouse";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getJobsStatsApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getJobsStatsApiRoute,
  async handler(input) {
    const days = input?.days || 1;
    const stats = await getJobStats({
      dateFrom: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      dateTo: new Date(),
    });

    return {
      active: stats.active,
      failed: stats.failed,
      completed: stats.completed,
    };
  },
});
