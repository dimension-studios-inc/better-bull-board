import { searchJobRuns } from "@better-bull-board/clickhouse";
import { createAuthenticatedApiRoute } from "~/lib/utils";
import { getJobsTableApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getJobsTableApiRoute,
  async handler(input) {
    const { cursor, search, limit, queue, status } = input;

    const jobs = await searchJobRuns({
      limit,
      offset: cursor ? Number(cursor) : 0,
      search,
      queue: queue === "all" ? undefined : queue,
      status: status === "all" ? undefined : status,
    });

    return {
      jobs,
      nextCursor: jobs.length ? (jobs[jobs.length - 1]?.id ?? null) : null,
    };
  },
});
