import { getDashboardSummary } from "~/app/api/dashboard/summary/handler";
import { getTopQueuesDurationApiRoute } from "~/app/api/dashboard/top-queues-duration/schemas";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getTopQueuesDurationApiRoute,
  async handler(input) {
    const days = input?.days || 1;
    const limit = input?.limit || 10;
    const summary = await getDashboardSummary({ days });
    return summary.topQueuesDuration.slice(0, limit);
  },
});
