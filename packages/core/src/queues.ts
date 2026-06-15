import { jobRunsTable, jobSchedulersTable, queuesTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { and, asc, desc, eq, gt, ilike, lt, or, sql } from "drizzle-orm";
import type { z } from "zod";
import { listQueuesInputSchema, listQueuesOutputSchema } from "./queue-schemas";

type CursorDirection = "next" | "prev";
type QueueSortBy = "waitingJobs" | "activeJobs";
type SortDirection = "asc" | "desc";
type QueueCursor = { waitingJobs: number; activeJobs?: number; name: string };

const waitingJobCounts = db
  .select({
    queue: jobRunsTable.queue,
    waitingJobs: sql<number>`COUNT(*)::int`.as("waiting_jobs"),
  })
  .from(jobRunsTable)
  .where(eq(jobRunsTable.status, "waiting"))
  .groupBy(jobRunsTable.queue)
  .as("waiting_job_counts");

const waitingJobsExpression = sql<number>`COALESCE(${waitingJobCounts.waitingJobs}, 0)`;

const activeJobCounts = db
  .select({
    queue: jobRunsTable.queue,
    activeJobs: sql<number>`COUNT(*)::int`.as("active_jobs"),
  })
  .from(jobRunsTable)
  .where(eq(jobRunsTable.status, "active"))
  .groupBy(jobRunsTable.queue)
  .as("active_job_counts");

const activeJobsExpression = sql<number>`COALESCE(${activeJobCounts.activeJobs}, 0)`;

const getSortExpression = (sortBy: QueueSortBy) => {
  if (sortBy === "activeJobs") return activeJobsExpression;
  return waitingJobsExpression;
};

const getCursorValue = (cursor: QueueCursor, sortBy: QueueSortBy) => {
  if (sortBy === "activeJobs") return cursor.activeJobs ?? 0;
  return cursor.waitingJobs;
};

const getOrderDirection = (cursorDirection: CursorDirection, sortDirection: SortDirection) => {
  if (cursorDirection === "next") return sortDirection;
  return sortDirection === "desc" ? "asc" : "desc";
};

const getCursorComparison = (
  cursor: QueueCursor,
  cursorDirection: CursorDirection,
  sortBy: QueueSortBy,
  sortDirection: SortDirection,
) => {
  const sortExpression = getSortExpression(sortBy);
  const cursorValue = getCursorValue(cursor, sortBy);
  const nameComparison =
    cursorDirection === "next" ? gt(queuesTable.name, cursor.name) : lt(queuesTable.name, cursor.name);
  const tiedSortComparison = and(eq(sortExpression, cursorValue), nameComparison);
  const shouldUseGreaterThan = cursorDirection === "next" ? sortDirection === "asc" : sortDirection === "desc";

  if (shouldUseGreaterThan) {
    return or(gt(sortExpression, cursorValue), tiedSortComparison);
  }

  return or(lt(sortExpression, cursorValue), tiedSortComparison);
};

const getSortOrder = (cursorDirection: CursorDirection, sortBy: QueueSortBy, sortDirection: SortDirection) => {
  const sortExpression = getSortExpression(sortBy);
  const orderDirection = getOrderDirection(cursorDirection, sortDirection);
  const sortOrder = orderDirection === "asc" ? asc(sortExpression) : desc(sortExpression);
  const nameOrder = cursorDirection === "next" ? asc(queuesTable.name) : desc(queuesTable.name);

  return [sortOrder, nameOrder];
};

export const listQueues = async (input: z.input<typeof listQueuesInputSchema> = {}) => {
  const {
    search,
    cursor,
    cursorDirection = "next",
    sortBy = "waitingJobs",
    sortDirection = "desc",
  } = listQueuesInputSchema.parse(input);
  const limit = input.limit ?? 20;

  const rows = await db
    .select({
      id: queuesTable.id,
      name: queuesTable.name,
      isPaused: queuesTable.isPaused,
      waitingJobs: waitingJobsExpression.as("waiting_jobs"),
      activeJobs: activeJobsExpression.as("active_jobs"),
      patterns: sql<string[] | null | undefined>`array_agg(${jobSchedulersTable.pattern})`.as("patterns"),
      everys: sql<number[] | null | undefined>`array_agg(${jobSchedulersTable.every})`.as("everys"),
    })
    .from(queuesTable)
    .leftJoin(waitingJobCounts, eq(waitingJobCounts.queue, queuesTable.name))
    .leftJoin(activeJobCounts, eq(activeJobCounts.queue, queuesTable.name))
    .leftJoin(jobSchedulersTable, eq(jobSchedulersTable.queueId, queuesTable.id))
    .where(
      and(
        cursor ? getCursorComparison(cursor, cursorDirection, sortBy, sortDirection) : undefined,
        search ? ilike(queuesTable.name, `%${search}%`) : undefined,
      ),
    )
    .groupBy(queuesTable.id, waitingJobCounts.waitingJobs, activeJobCounts.activeJobs)
    .orderBy(...getSortOrder(cursorDirection, sortBy, sortDirection))
    .limit(limit + 1);

  const hasExtra = rows.length > limit;

  if (hasExtra) {
    rows.pop();
  }

  const queueRows = cursorDirection === "prev" ? rows.reverse() : rows;
  const [total] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(queuesTable)
    .where(search ? ilike(queuesTable.name, `%${search}%`) : undefined);

  const firstRow = queueRows[0];
  const lastRow = queueRows.at(-1);
  const hasNewerPage = cursorDirection === "next" ? Boolean(cursor) : hasExtra;
  const hasOlderPage = cursorDirection === "prev" ? Boolean(cursor) : hasExtra;

  return listQueuesOutputSchema.parse({
    queues: queueRows.map((row) => ({
      name: row.name,
      isPaused: row.isPaused,
      patterns: row.patterns?.filter(Boolean) ?? [],
      everys: row.everys?.filter(Boolean) ?? [],
      waitingJobs: Number(row.waitingJobs ?? 0),
      activeJobs: Number(row.activeJobs ?? 0),
    })),
    nextCursor:
      hasOlderPage && lastRow
        ? {
            name: lastRow.name,
            waitingJobs: Number(lastRow.waitingJobs ?? 0),
            activeJobs: Number(lastRow.activeJobs ?? 0),
          }
        : null,
    prevCursor:
      hasNewerPage && firstRow
        ? {
            name: firstRow.name,
            waitingJobs: Number(firstRow.waitingJobs ?? 0),
            activeJobs: Number(firstRow.activeJobs ?? 0),
          }
        : null,
    total: Number(total?.count ?? 0),
  });
};
