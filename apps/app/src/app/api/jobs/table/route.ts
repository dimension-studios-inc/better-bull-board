import { jobRunsTable, type jobStatusEnum } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { and, asc, desc, eq, gt, ilike, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getJobsTableApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getJobsTableApiRoute,
  async handler(input) {
    const { cursor, search, queue, status, tags } = input;
    const limit = input.limit ?? 20;

    const getRows = async (direction: "next" | "prev") => {
      const conditions = [];

      if (search) {
        // Search filters
        const searchConditions = [
          ilike(jobRunsTable.name, `%${search}%`),
          ilike(jobRunsTable.queue, `%${search}%`),
          ilike(jobRunsTable.jobId, `%${search}%`),
          ilike(jobRunsTable.errorMessage, `%${search}%`),
        ];
        if (z.uuid().safeParse(search).success) {
          searchConditions.push(eq(jobRunsTable.id, search));
        }
        conditions.push(or(...searchConditions));
      }

      if (queue && queue !== "all") {
        conditions.push(eq(jobRunsTable.queue, queue));
      }

      if (status && status !== "all") {
        conditions.push(
          eq(
            jobRunsTable.status,
            status as (typeof jobStatusEnum.enumValues)[number],
          ),
        );
      }

      if (tags && tags.length > 0) {
        conditions.push(sql`${jobRunsTable.tags} && ${tags}`);
      }

      if (cursor) {
        // Cursor filtering
        const { createdAt, jobId, id } = cursor;
        const createdAtDate = new Date(createdAt);

        const comparison =
          direction === "next"
            ? or(
                lt(jobRunsTable.createdAt, createdAtDate),
                and(
                  eq(jobRunsTable.createdAt, createdAtDate),
                  lt(jobRunsTable.jobId, jobId),
                ),
                and(
                  eq(jobRunsTable.createdAt, createdAtDate),
                  eq(jobRunsTable.jobId, jobId),
                  lt(jobRunsTable.id, id),
                ),
              )
            : or(
                gt(jobRunsTable.createdAt, createdAtDate),
                and(
                  eq(jobRunsTable.createdAt, createdAtDate),
                  gt(jobRunsTable.jobId, jobId),
                ),
                and(
                  eq(jobRunsTable.createdAt, createdAtDate),
                  eq(jobRunsTable.jobId, jobId),
                  gt(jobRunsTable.id, id),
                ),
              );

        conditions.push(comparison);
      }

      // Determine sort order
      const order =
        direction === "next"
          ? [
              desc(jobRunsTable.createdAt),
              desc(jobRunsTable.jobId),
              desc(jobRunsTable.id),
            ]
          : [
              asc(jobRunsTable.createdAt),
              asc(jobRunsTable.jobId),
              asc(jobRunsTable.id),
            ];

      // Fetch one extra record to detect next page
      const result = await db
        .select()
        .from(jobRunsTable)
        .where(and(...conditions))
        .orderBy(...order)
        .limit(limit + 1);

      return result;
    };

    const jobs = await getRows("next");
    const previousJobs = cursor ? await getRows("prev") : [];

    const nextCursor = jobs.length > limit ? (jobs.pop() ?? null) : null;
    const prevCursor =
      previousJobs.length > limit ? (previousJobs.pop() ?? null) : null;

    const hasMore = nextCursor !== null;

    return { jobs, nextCursor, prevCursor, hasMore };
  },
});
