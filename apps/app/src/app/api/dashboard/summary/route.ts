import { getDashboardSummary } from "~/app/api/dashboard/summary/handler";
import { getDashboardSummaryApiRoute } from "~/app/api/dashboard/summary/schemas";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getDashboardSummaryApiRoute,
  async handler(input) {
    return getDashboardSummary({ days: input.days });
  },
});
