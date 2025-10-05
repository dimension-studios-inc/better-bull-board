import { jobRunsTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { sql } from "drizzle-orm";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getTagsApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getTagsApiRoute,
  async handler(input) {
    const { search } = input;

    const tags = await db
      .select({
        tag: sql<string>`unnest(${jobRunsTable.tags})`,
      })
      .from(jobRunsTable)
      .where(
        search
          ? sql`unnest(${jobRunsTable.tags}) ILIKE ${`%${search}%`}`
          : undefined,
      )
      .groupBy(sql`unnest(${jobRunsTable.tags})`)
      .orderBy(sql`unnest(${jobRunsTable.tags})`)
      .limit(100);

    return {
      tags: tags.map((row) => row.tag).filter(Boolean),
    };
  },
});
