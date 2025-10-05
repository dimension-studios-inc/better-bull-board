import { jobRunsTable, type jobStatusEnum } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getJobsTableApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getJobsTableApiRoute,
  async handler(input) {
    const { cursor, search, queue, status, tags } = input;
    const limit = input.limit ?? 20;

    const conditions = [];

    if (search) {
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
      const { createdAt, jobId, id } = cursor;
      const createdAtDate = new Date(createdAt);

      if (cursor) {
        conditions.push(
          or(
            sql`${jobRunsTable.createdAt} < ${createdAtDate}`,
            and(
              sql`${jobRunsTable.createdAt} = ${createdAtDate}`,
              sql`${jobRunsTable.jobId} < ${jobId}`,
            ),
            and(
              sql`${jobRunsTable.createdAt} = ${createdAtDate}`,
              sql`${jobRunsTable.jobId} = ${jobId}`,
              sql`${jobRunsTable.id} < ${id}`,
            ),
          ),
        );
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const jobs = await db
      .select()
      .from(jobRunsTable)
      .where(whereClause)
      .orderBy(
        desc(jobRunsTable.createdAt),
        desc(jobRunsTable.jobId),
        desc(jobRunsTable.id),
      )
      .limit(limit + 1);

    const previousJobs = cursor
      ? await db
          .select()
          .from(jobRunsTable)
          .where(whereClause)
          .orderBy(
            asc(jobRunsTable.createdAt),
            asc(jobRunsTable.jobId),
            asc(jobRunsTable.id),
          )
          .limit(limit + 1)
      : [];

    const nextCursor: { createdAt: Date; jobId: string; id: string } | null =
      jobs.length > limit ? (jobs.pop() ?? null) : null;
    const prevCursor: { createdAt: Date; jobId: string; id: string } | null =
      previousJobs.length > limit
        ? // Since we are in desc order we need to shift not pop
          (previousJobs.pop() ?? null)
        : null;

    return {
      jobs,
      nextCursor,
      prevCursor,
    };
  },
});
