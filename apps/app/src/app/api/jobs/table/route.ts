import { searchJobRuns } from "@better-bull-board/clickhouse";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getJobsTableApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getJobsTableApiRoute,
  async handler(input) {
    const { cursor, search, queue, status, tags } = input;
    const limit = input.limit ?? 20;

    const jobs = await searchJobRuns({
      limit: limit + 1,
      cursor,
      direction: "desc",
      search,
      queue: queue === "all" ? undefined : queue,
      status: status === "all" ? undefined : status,
      tags: tags && tags.length > 0 ? tags : undefined,
    });

    const previousJobs = cursor
      ? await searchJobRuns({
          limit: limit + 1,
          cursor,
          direction: "asc",
          search,
          queue: queue === "all" ? undefined : queue,
          status: status === "all" ? undefined : status,
          tags: tags && tags.length > 0 ? tags : undefined,
        })
      : [];

    let nextCursor: { created_at: number; job_id: string; id: string } | null =
      jobs.length > limit ? (jobs.pop() ?? null) : null;
    if (nextCursor) {
      nextCursor = {
        created_at: nextCursor.created_at,
        job_id: nextCursor.job_id,
        id: nextCursor.id,
      };
    }
    let prevCursor: { created_at: number; job_id: string; id: string } | null =
      previousJobs.length > limit
        ? // Since we are in desc order we need to shift not pop
          (previousJobs.at(2) ?? null)
        : null;
    if (prevCursor) {
      prevCursor = {
        created_at: prevCursor.created_at,
        job_id: prevCursor.job_id,
        id: prevCursor.id,
      };
    }

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
