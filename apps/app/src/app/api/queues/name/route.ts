import { queuesTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { and, asc, desc, gte, ilike, lt, sql } from "drizzle-orm";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getQueuesNameApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getQueuesNameApiRoute,
  async handler(input) {
    const { cursor, search } = input;
    const limit = input.limit ?? 20;

    const getRows = async (direction: "next" | "prev") => {
      return db
        .select({
          id: queuesTable.id,
          name: queuesTable.name,
        })
        .from(queuesTable)
        .where(
          and(
            cursor ? (direction === "prev" ? lt(queuesTable.name, cursor) : gte(queuesTable.name, cursor)) : undefined,
            search ? ilike(queuesTable.name, `%${search}%`) : undefined,
          ),
        )
        .groupBy(queuesTable.id)
        .orderBy(direction === "prev" ? desc(queuesTable.name) : asc(queuesTable.name))
        .limit(limit + 1);
    };

    // Get queue info from Postgres (basic queue data)
    const rows = await getRows("next");
    const previousRows = cursor ? await getRows("prev") : [];

    const [total] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(queuesTable)
      .where(search ? ilike(queuesTable.name, `%${search}%`) : undefined);

    const nextCursor = rows.length > limit ? (rows.pop()?.name ?? null) : null;
    const prevCursor = previousRows.length > limit ? (previousRows.at(-2)?.name ?? null) : null;

    return {
      queues: rows,
      nextCursor,
      prevCursor,
      total: Number(total?.count ?? 0),
    };
  },
});
