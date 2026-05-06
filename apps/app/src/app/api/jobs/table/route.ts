import { jobRunsTable, type jobStatusEnum } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { and, arrayOverlaps, asc, desc, eq, gt, gte, ilike, lt, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getJobsTableApiRoute } from "./schemas";

type CursorDirection = "next" | "prev";
type SortBy = "createdAt" | "durationMs";
type SortDirection = "asc" | "desc";

const jobTableColumns = {
  id: jobRunsTable.id,
  jobId: jobRunsTable.jobId,
  queue: jobRunsTable.queue,
  name: jobRunsTable.name,
  status: jobRunsTable.status,
  attempt: jobRunsTable.attempt,
  maxAttempts: jobRunsTable.maxAttempts,
  createdAt: jobRunsTable.createdAt,
  enqueuedAt: jobRunsTable.enqueuedAt,
  startedAt: jobRunsTable.startedAt,
  finishedAt: jobRunsTable.finishedAt,
  durationMs: jobRunsTable.durationMs,
  errorMessage: jobRunsTable.errorMessage,
  tags: jobRunsTable.tags,
};

type JobCursor = { createdAt: Date; jobId: string; id: string; durationMs?: number | null };

const parseCreatedBoundary = ({
  fallbackTime,
  isUpperBoundary = false,
  value,
}: {
  fallbackTime: string;
  isUpperBoundary?: boolean;
  value: string;
}) => {
  const date = new Date(value.includes("T") ? value : `${value}T${fallbackTime}`);

  if (isUpperBoundary && /T\d{2}:\d{2}$/.test(value)) {
    date.setSeconds(59, 999);
  }

  return date;
};

const toCursor = (job: JobCursor) => ({
  createdAt: job.createdAt,
  jobId: job.jobId,
  id: job.id,
  durationMs: job.durationMs ?? null,
});

const getOrderDirection = (cursorDirection: CursorDirection, sortDirection: SortDirection) => {
  if (cursorDirection === "next") return sortDirection;
  return sortDirection === "desc" ? "asc" : "desc";
};

const getSortOrder = ({
  cursorDirection,
  durationSortExpression,
  sortBy,
  sortDirection,
}: {
  cursorDirection: CursorDirection;
  durationSortExpression: ReturnType<typeof sql<number>>;
  sortBy: SortBy;
  sortDirection: SortDirection;
}) => {
  const orderDirection = getOrderDirection(cursorDirection, sortDirection);

  if (sortBy === "durationMs") {
    return orderDirection === "desc"
      ? [desc(durationSortExpression), desc(jobRunsTable.createdAt), desc(jobRunsTable.jobId), desc(jobRunsTable.id)]
      : [asc(durationSortExpression), asc(jobRunsTable.createdAt), asc(jobRunsTable.jobId), asc(jobRunsTable.id)];
  }

  return orderDirection === "desc"
    ? [desc(jobRunsTable.createdAt), desc(jobRunsTable.jobId), desc(jobRunsTable.id)]
    : [asc(jobRunsTable.createdAt), asc(jobRunsTable.jobId), asc(jobRunsTable.id)];
};

const getCreatedAtCursorComparison = ({
  createdAt,
  id,
  jobId,
  useLessThan,
}: {
  createdAt: Date;
  id: string;
  jobId: string;
  useLessThan: boolean;
}) =>
  useLessThan
    ? or(
        lt(jobRunsTable.createdAt, createdAt),
        and(eq(jobRunsTable.createdAt, createdAt), lt(jobRunsTable.jobId, jobId)),
        and(eq(jobRunsTable.createdAt, createdAt), eq(jobRunsTable.jobId, jobId), lt(jobRunsTable.id, id)),
      )
    : or(
        gt(jobRunsTable.createdAt, createdAt),
        and(eq(jobRunsTable.createdAt, createdAt), gt(jobRunsTable.jobId, jobId)),
        and(eq(jobRunsTable.createdAt, createdAt), eq(jobRunsTable.jobId, jobId), gt(jobRunsTable.id, id)),
      );

const getCursorComparison = ({
  cursor,
  cursorDirection,
  durationSortExpression,
  sortBy,
  sortDirection,
}: {
  cursor: { createdAt: number; jobId: string; id: string; durationMs?: number | null };
  cursorDirection: CursorDirection;
  durationSortExpression: ReturnType<typeof sql<number>>;
  sortBy: SortBy;
  sortDirection: SortDirection;
}) => {
  const createdAt = new Date(cursor.createdAt);
  const useLessThan = cursorDirection === "next" ? sortDirection === "desc" : sortDirection === "asc";
  const createdAtComparison = getCreatedAtCursorComparison({
    createdAt,
    id: cursor.id,
    jobId: cursor.jobId,
    useLessThan,
  });

  if (sortBy !== "durationMs") {
    return createdAtComparison;
  }

  const durationMs = cursor.durationMs ?? 0;
  return or(
    useLessThan ? lt(durationSortExpression, durationMs) : gt(durationSortExpression, durationMs),
    and(eq(durationSortExpression, durationMs), createdAtComparison),
  );
};

export const POST = createAuthenticatedApiRoute({
  apiRoute: getJobsTableApiRoute,
  async handler(input) {
    const { cursor, cursorDirection = "next", search, queue, status, tags, createdFrom, createdTo } = input;
    const limit = input.limit ?? 20;
    const sortBy = input.sortBy ?? "createdAt";
    const sortDirection = input.sortDirection ?? "desc";
    const durationSortExpression = sql<number>`COALESCE(${jobRunsTable.durationMs}, 0)`;

    const getRows = async (direction: CursorDirection) => {
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
        conditions.push(eq(jobRunsTable.status, status as (typeof jobStatusEnum.enumValues)[number]));
      }

      if (tags && tags.length > 0) {
        conditions.push(arrayOverlaps(jobRunsTable.tags, tags));
      }

      if (createdFrom) {
        conditions.push(
          gte(jobRunsTable.createdAt, parseCreatedBoundary({ value: createdFrom, fallbackTime: "00:00" })),
        );
      }

      if (createdTo) {
        conditions.push(
          lte(
            jobRunsTable.createdAt,
            parseCreatedBoundary({ value: createdTo, fallbackTime: "23:59:59.999", isUpperBoundary: true }),
          ),
        );
      }

      if (cursor) {
        conditions.push(
          getCursorComparison({
            cursor,
            cursorDirection: direction,
            durationSortExpression,
            sortBy,
            sortDirection,
          }),
        );
      }

      const order = getSortOrder({
        cursorDirection: direction,
        durationSortExpression,
        sortBy,
        sortDirection,
      });

      return db
        .select(jobTableColumns)
        .from(jobRunsTable)
        .where(and(...conditions))
        .orderBy(...order)
        .limit(limit + 1);
    };

    const rows = await getRows(cursorDirection);
    const hasExtra = rows.length > limit;

    if (hasExtra) {
      rows.pop();
    }

    const jobs = cursorDirection === "prev" ? rows.reverse() : rows;
    const firstJob = jobs[0];
    const lastJob = jobs.at(-1);
    const hasNewerPage = cursorDirection === "next" ? Boolean(cursor) : hasExtra;
    const hasOlderPage = cursorDirection === "prev" ? Boolean(cursor) : hasExtra;

    return {
      jobs,
      nextCursor: hasOlderPage && lastJob ? toCursor(lastJob) : null,
      prevCursor: hasNewerPage && firstJob ? toCursor(firstJob) : null,
    };
  },
});
