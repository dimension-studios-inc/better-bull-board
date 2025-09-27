import { searchJobRuns } from "@better-bull-board/clickhouse";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getJobsTableApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getJobsTableApiRoute,
  async handler(input) {
    const { cursor, search, queue, status } = input;
    const limit = input.limit ?? 20;

    const jobs = await searchJobRuns({
      limit: limit + 1,
      cursor,
      direction: "next",
      search,
      queue: queue === "all" ? undefined : queue,
      status: status === "all" ? undefined : status,
    });

    const previousJobs = cursor
      ? await searchJobRuns({
          limit: limit + 1,
          cursor,
          direction: "prev",
          search,
          queue: queue === "all" ? undefined : queue,
          status: status === "all" ? undefined : status,
        })
      : [];

    const nextCursor =
      jobs.length > limit ? (jobs.pop()?.created_at ?? null) : null;
    const prevCursor =
      previousJobs.length > limit
        ? // Since we are in desc order we need to shift not pop
          (previousJobs.at(2)?.created_at ?? null)
        : null;

    return {
      jobs: jobs.map((job) => ({
        ...job,
        created_at: new Date(job.created_at),
        enqueued_at: job.enqueued_at ? new Date(job.enqueued_at) : null,
        started_at: job.started_at ? new Date(job.started_at) : null,
        finished_at: job.finished_at ? new Date(job.finished_at) : null,
      })),
      nextCursor,
      prevCursor,
    };
  },
});
