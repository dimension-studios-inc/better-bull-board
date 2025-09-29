import { getTopQueuesByRunCount } from "@better-bull-board/clickhouse";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getTopQueuesCountApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getTopQueuesCountApiRoute,
  async handler(input) {
    const days = input?.days || 1;
    const limit = input?.limit || 10;
    const data = await getTopQueuesByRunCount({
      dateFrom: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      dateTo: new Date(),
      limit,
    });

    return data;
  },
});
