import { getQueuePerformanceData } from "@better-bull-board/clickhouse";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getQueuePerformanceApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getQueuePerformanceApiRoute,
  async handler(input) {
    const days = input?.days || 1;
    const data = await getQueuePerformanceData({
      dateFrom: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      dateTo: new Date(),
    });

    return data;
  },
});