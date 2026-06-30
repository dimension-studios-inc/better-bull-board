import { dashboardQueueHourlyStatsTable, jobRunsTable, jobSchedulersTable, queuesTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { and, asc, desc, eq, gt, gte, ilike, lt, or, sql } from "drizzle-orm";
import type { z } from "zod";
import { listQueuesInputSchema, listQueuesOutputSchema } from "./queue-schemas";

type CursorDirection = "next" | "prev";
type QueueSortBy = "waitingJobs" | "activeJobs" | "pressure";
type SortDirection = "asc" | "desc";
type QueueCursor = { waitingJobs: number; activeJobs?: number; pressure?: number; name: string };

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

const queueSelectFields = {
  id: queuesTable.id,
  name: queuesTable.name,
  isPaused: queuesTable.isPaused,
  waitingJobs: waitingJobsExpression.as("waiting_jobs"),
  activeJobs: activeJobsExpression.as("active_jobs"),
  patterns: sql<string[] | null | undefined>`array_agg(${jobSchedulersTable.pattern})`.as("patterns"),
  everys: sql<number[] | null | undefined>`array_agg(${jobSchedulersTable.every})`.as("everys"),
};

const buildPressureStats = (dateFrom?: Date, dateTo?: Date) =>
  db
    .select({
      queue: dashboardQueueHourlyStatsTable.queue,
      pressure: sql<number | null>`ROUND(
        SUM(${dashboardQueueHourlyStatsTable.pressureTotalMs})::numeric
        / NULLIF(SUM(${dashboardQueueHourlyStatsTable.pressureCount}), 0)
      )`.as("pressure"),
    })
    .from(dashboardQueueHourlyStatsTable)
    .where(
      and(
        dateFrom ? gte(dashboardQueueHourlyStatsTable.bucketStart, dateFrom) : undefined,
        dateTo ? lt(dashboardQueueHourlyStatsTable.bucketStart, dateTo) : undefined,
      ),
    )
    .groupBy(dashboardQueueHourlyStatsTable.queue)
    .as("pressure_stats");

type PressureStats = ReturnType<typeof buildPressureStats>;

const getSortExpression = (sortBy: QueueSortBy, pressureStats?: PressureStats) => {
  if (sortBy === "pressure") {
    if (!pressureStats) {
      throw new Error("Pressure sort requires pressure stats");
    }
    return sql<number>`COALESCE(${pressureStats.pressure}, 0)`;
  }
  if (sortBy === "activeJobs") return activeJobsExpression;
  return waitingJobsExpression;
};

const getCursorValue = (cursor: QueueCursor, sortBy: QueueSortBy) => {
  if (sortBy === "pressure") {
    if (cursor.pressure === undefined) {
      throw new Error("Pressure cursor is required when sorting by pressure");
    }
    return cursor.pressure;
  }
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
  pressureStats?: PressureStats,
) => {
  const sortExpression = getSortExpression(sortBy, pressureStats);
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

const getSortOrder = (
  cursorDirection: CursorDirection,
  sortBy: QueueSortBy,
  sortDirection: SortDirection,
  pressureStats?: PressureStats,
) => {
  const sortExpression = getSortExpression(sortBy, pressureStats);
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
    pressureDateFrom,
    pressureDateTo,
  } = listQueuesInputSchema.parse(input);
  const limit = input.limit ?? 20;
  const rows =
    sortBy === "pressure"
      ? await listQueuesSortedByPressure({
          cursor,
          cursorDirection,
          limit,
          pressureDateFrom,
          pressureDateTo,
          search,
          sortDirection,
        })
      : await listQueuesSortedByJobCount({
          cursor,
          cursorDirection,
          limit,
          search,
          sortBy,
          sortDirection,
        });

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
      pressure: Number(row.pressure ?? 0),
    })),
    nextCursor:
      hasOlderPage && lastRow
        ? {
            name: lastRow.name,
            waitingJobs: Number(lastRow.waitingJobs ?? 0),
            activeJobs: Number(lastRow.activeJobs ?? 0),
            pressure: Number(lastRow.pressure ?? 0),
          }
        : null,
    prevCursor:
      hasNewerPage && firstRow
        ? {
            name: firstRow.name,
            waitingJobs: Number(firstRow.waitingJobs ?? 0),
            activeJobs: Number(firstRow.activeJobs ?? 0),
            pressure: Number(firstRow.pressure ?? 0),
          }
        : null,
    total: Number(total?.count ?? 0),
  });
};

async function listQueuesSortedByPressure({
  cursor,
  cursorDirection,
  limit,
  pressureDateFrom,
  pressureDateTo,
  search,
  sortDirection,
}: {
  cursor: QueueCursor | null | undefined;
  cursorDirection: CursorDirection;
  limit: number;
  pressureDateFrom?: Date;
  pressureDateTo?: Date;
  search?: string;
  sortDirection: SortDirection;
}) {
  const pressureStats = buildPressureStats(pressureDateFrom, pressureDateTo);

  return db
    .select({
      ...queueSelectFields,
      pressure: pressureStats.pressure,
    })
    .from(queuesTable)
    .leftJoin(waitingJobCounts, eq(waitingJobCounts.queue, queuesTable.name))
    .leftJoin(activeJobCounts, eq(activeJobCounts.queue, queuesTable.name))
    .leftJoin(pressureStats, eq(pressureStats.queue, queuesTable.name))
    .leftJoin(jobSchedulersTable, eq(jobSchedulersTable.queueId, queuesTable.id))
    .where(
      and(
        cursor ? getCursorComparison(cursor, cursorDirection, "pressure", sortDirection, pressureStats) : undefined,
        search ? ilike(queuesTable.name, `%${search}%`) : undefined,
      ),
    )
    .groupBy(queuesTable.id, waitingJobCounts.waitingJobs, activeJobCounts.activeJobs, pressureStats.pressure)
    .orderBy(...getSortOrder(cursorDirection, "pressure", sortDirection, pressureStats))
    .limit(limit + 1);
}

async function listQueuesSortedByJobCount({
  cursor,
  cursorDirection,
  limit,
  search,
  sortBy,
  sortDirection,
}: {
  cursor: QueueCursor | null | undefined;
  cursorDirection: CursorDirection;
  limit: number;
  search?: string;
  sortBy: Exclude<QueueSortBy, "pressure">;
  sortDirection: SortDirection;
}) {
  return db
    .select({
      ...queueSelectFields,
      pressure: sql<number>`0`.as("pressure"),
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
}
