import { getQueuePerformanceApiRoute } from "~/app/api/dashboard/queue-performance/schemas";
import { getDashboardSummary } from "~/app/api/dashboard/summary/handler";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getQueuePerformanceApiRoute,
  async handler(input) {
    const days = input?.days || 1;
    const summary = await getDashboardSummary({ days });
    return summary.queuePerformance;
  },
});
