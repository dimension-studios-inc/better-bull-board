import { getRunGraphData } from "@better-bull-board/clickhouse";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getRunGraphApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getRunGraphApiRoute,
  async handler(input) {
    const days = input?.days || 1;
    const data = await getRunGraphData({
      dateFrom: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      dateTo: new Date(),
      timePeriod: days,
    });

    return data;
  },
});