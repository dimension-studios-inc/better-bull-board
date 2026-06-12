import { jobRunsTable, jobSchedulersTable, queuesTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { and, asc, desc, eq, gt, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { z } from "zod";

type CursorDirection = "next" | "prev";
type QueueCursor = { waitingJobs: number; name: string };

export const listQueuesInputSchema = z.object({
  cursor: z
    .object({
      waitingJobs: z.number(),
      name: z.string(),
    })
    .nullish(),
  cursorDirection: z.enum(["next", "prev"]).optional(),
  search: z.string().optional(),
  limit: z.number().min(1).max(100).optional(),
});

export const listQueuesOutputSchema = z.object({
  queues: z.array(
    z.object({
      name: z.string(),
      isPaused: z.boolean(),
      patterns: z.array(z.string()),
      everys: z.array(z.number()),
      waitingJobs: z.number(),
      activeJobs: z.number(),
    }),
  ),
  nextCursor: z
    .object({
      waitingJobs: z.number(),
      name: z.string(),
    })
    .nullable(),
  prevCursor: z
    .object({
      waitingJobs: z.number(),
      name: z.string(),
    })
    .nullable(),
  total: z.number(),
});

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

const getCursorComparison = (cursor: QueueCursor, direction: CursorDirection) => {
  if (direction === "prev") {
    return or(
      gt(waitingJobsExpression, cursor.waitingJobs),
      and(eq(waitingJobsExpression, cursor.waitingJobs), lt(queuesTable.name, cursor.name)),
    );
  }

  return or(
    lt(waitingJobsExpression, cursor.waitingJobs),
    and(eq(waitingJobsExpression, cursor.waitingJobs), gt(queuesTable.name, cursor.name)),
  );
};

const getSortOrder = (direction: CursorDirection) => {
  if (direction === "prev") {
    return [asc(waitingJobsExpression), desc(queuesTable.name)];
  }

  return [desc(waitingJobsExpression), asc(queuesTable.name)];
};

export const listQueues = async (input: z.input<typeof listQueuesInputSchema> = {}) => {
  const { search, cursor, cursorDirection = "next" } = listQueuesInputSchema.parse(input);
  const limit = input.limit ?? 20;

  const rows = await db
    .select({
      id: queuesTable.id,
      name: queuesTable.name,
      isPaused: queuesTable.isPaused,
      waitingJobs: waitingJobsExpression.as("waiting_jobs"),
      patterns: sql<string[] | null | undefined>`array_agg(${jobSchedulersTable.pattern})`.as("patterns"),
      everys: sql<number[] | null | undefined>`array_agg(${jobSchedulersTable.every})`.as("everys"),
    })
    .from(queuesTable)
    .leftJoin(waitingJobCounts, eq(waitingJobCounts.queue, queuesTable.name))
    .leftJoin(jobSchedulersTable, eq(jobSchedulersTable.queueId, queuesTable.id))
    .where(
      and(
        cursor ? getCursorComparison(cursor, cursorDirection) : undefined,
        search ? ilike(queuesTable.name, `%${search}%`) : undefined,
      ),
    )
    .groupBy(queuesTable.id, waitingJobCounts.waitingJobs)
    .orderBy(...getSortOrder(cursorDirection))
    .limit(limit + 1);

  const hasExtra = rows.length > limit;

  if (hasExtra) {
    rows.pop();
  }

  const queueRows = cursorDirection === "prev" ? rows.reverse() : rows;
  const queueNames = queueRows.map((row) => row.name);

  const [[total], allCounts] = await Promise.all([
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(queuesTable)
      .where(search ? ilike(queuesTable.name, `%${search}%`) : undefined),
    queueNames.length > 0
      ? db
          .select({
            name: queuesTable.name,
            waitingJobs: sql<number>`(
              SELECT COUNT(*)
              FROM ${jobRunsTable}
              WHERE ${jobRunsTable.queue} = queues.name
              AND ${jobRunsTable.status} = 'waiting')`.as("waiting_jobs"),
            activeJobs:
              sql<number>`(SELECT COUNT(*) FROM ${jobRunsTable} WHERE ${jobRunsTable.queue} = queues.name AND ${jobRunsTable.status} = 'active')`.as(
                "active_jobs",
              ),
          })
          .from(queuesTable)
          .where(inArray(queuesTable.name, queueNames))
      : [],
  ]);

  const countsMap = new Map(allCounts.map((count) => [count.name, count]));
  const firstRow = queueRows[0];
  const lastRow = queueRows.at(-1);
  const hasNewerPage = cursorDirection === "next" ? Boolean(cursor) : hasExtra;
  const hasOlderPage = cursorDirection === "prev" ? Boolean(cursor) : hasExtra;

  return listQueuesOutputSchema.parse({
    queues: queueRows.map((row) => {
      const counts = countsMap.get(row.name);

      return {
        name: row.name,
        isPaused: row.isPaused,
        patterns: row.patterns?.filter(Boolean) ?? [],
        everys: row.everys?.filter(Boolean) ?? [],
        waitingJobs: Number(counts?.waitingJobs ?? 0),
        activeJobs: Number(counts?.activeJobs ?? 0),
      };
    }),
    nextCursor: hasOlderPage && lastRow ? { name: lastRow.name, waitingJobs: Number(lastRow.waitingJobs) } : null,
    prevCursor: hasNewerPage && firstRow ? { name: firstRow.name, waitingJobs: Number(firstRow.waitingJobs) } : null,
    total: Number(total?.count ?? 0),
  });
};
