import { jobLogsTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { and, asc, eq, ilike, sql } from "drizzle-orm";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getJobLogsApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getJobLogsApiRoute,
  async handler(input) {
    const { id, level, messageContains, limit = 100, offset = 0 } = input;

    const conditions = [];

    if (id) {
      conditions.push(eq(jobLogsTable.jobRunId, id));
    }

    if (level) {
      conditions.push(eq(jobLogsTable.level, level));
    }

    if (messageContains) {
      conditions.push(ilike(jobLogsTable.message, `%${messageContains}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [logs, [countRow]] = await Promise.all([
      db
        .select()
        .from(jobLogsTable)
        .where(whereClause)
        .orderBy(asc(jobLogsTable.ts), asc(jobLogsTable.logSeq))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(jobLogsTable).where(whereClause),
    ]);
    const count = countRow?.count ?? 0;

    return {
      logs: logs.map((log) => ({
        ...log,
        ts: log.ts.getTime(),
      })),
      total: Number(count),
    };
  },
});
