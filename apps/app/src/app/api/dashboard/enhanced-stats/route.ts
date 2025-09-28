import { getEnhancedJobStats } from "@better-bull-board/clickhouse";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getEnhancedStatsApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getEnhancedStatsApiRoute,
  async handler(input) {
    const days = input?.days || 1;
    const stats = await getEnhancedJobStats({
      dateFrom: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      dateTo: new Date(),
    });

    return stats;
  },
});