import { searchJobRuns } from "@better-bull-board/clickhouse";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getJobsTableApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getJobsTableApiRoute,
  async handler(input) {
    const { cursor, direction, search, limit, queue, status } = input;

    const jobs = await searchJobRuns({
      limit,
      cursor,
      direction,
      search,
      queue: queue === "all" ? undefined : queue,
      status: status === "all" ? undefined : status,
    });

    return {
      jobs,
      nextCursor: jobs.length ? (jobs[jobs.length - 1]?.id ?? null) : null,
      prevCursor: jobs.length ? (jobs[0]?.id ?? null) : null,
    };
  },
});
