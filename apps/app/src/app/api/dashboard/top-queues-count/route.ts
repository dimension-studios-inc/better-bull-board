import { getDashboardSummary } from "~/app/api/dashboard/summary/handler";
import { getTopQueuesCountApiRoute } from "~/app/api/dashboard/top-queues-count/schemas";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getTopQueuesCountApiRoute,
  async handler(input) {
    const days = input?.days || 1;
    const limit = input?.limit || 10;
    const summary = await getDashboardSummary({ days });
    return summary.topQueuesCount.slice(0, limit);
  },
});
