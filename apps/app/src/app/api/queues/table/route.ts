import {
  jobRunsTable,
  jobSchedulersTable,
  queuesTable,
} from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { and, eq, gt, ilike, sql } from "drizzle-orm";
import { createApiRoute } from "~/lib/utils";
import { getQueuesTableApiRoute } from "./schemas";

export const POST = createApiRoute({
  apiRoute: getQueuesTableApiRoute,
  async handler(input) {
    const { cursor, search, limit } = input;

    const rows = await db
      .select({
        id: queuesTable.id,
        name: queuesTable.name,
        isPaused: queuesTable.isPaused,
        pattern: jobSchedulersTable.pattern,
        every: jobSchedulersTable.every,
        activeJobs: sql<number>`COUNT(*) FILTER (WHERE ${jobRunsTable.status} = 'active')`,
        failedJobs: sql<number>`COUNT(*) FILTER (WHERE ${jobRunsTable.status} = 'failed')`,
        completedJobs: sql<number>`COUNT(*) FILTER (WHERE ${jobRunsTable.status} = 'completed')`,
        workers: sql<number>`COUNT(DISTINCT ${jobRunsTable.workerId})`,
      })
      .from(queuesTable)
      .leftJoin(
        jobSchedulersTable,
        eq(jobSchedulersTable.queueId, queuesTable.id),
      )
      .leftJoin(jobRunsTable, eq(jobRunsTable.queue, queuesTable.name))
      .where(
        and(
          cursor ? gt(queuesTable.id, cursor) : undefined,
          search ? ilike(queuesTable.name, `%${search}%`) : undefined,
        ),
      )
      .groupBy(
        queuesTable.id,
        queuesTable.name,
        queuesTable.isPaused,
        jobSchedulersTable.pattern,
        jobSchedulersTable.every,
      )
      .orderBy(queuesTable.id)
      .limit(limit ?? 20);

    const [total] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(queuesTable)
      .where(search ? ilike(queuesTable.name, `%${search}%`) : undefined);

    return {
      queues: rows.map((row) => ({
        name: row.name,
        isPaused: row.isPaused,
        pattern: row.pattern,
        every: row.every,
        activeJobs: Number(row.activeJobs ?? 0),
        failedJobs: Number(row.failedJobs ?? 0),
        completedJobs: Number(row.completedJobs ?? 0),
        workers: Number(row.workers ?? 0),
      })),
      nextCursor: rows.length ? (rows[rows.length - 1]?.id ?? null) : null,
      total: Number(total?.count ?? 0),
    };
  },
});
