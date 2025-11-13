import { jobRunsTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { sql } from "drizzle-orm";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getTagsApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getTagsApiRoute,
  async handler(input) {
    const { search } = input;

    // Use a subquery to unnest tags first, then filter on the unnested values
    // We can't use unnest() in WHERE, so we unnest in a subquery and filter in the outer query
    const tags = await db.execute(
      search
        ? sql`
          SELECT DISTINCT unnested_tag AS tag
          FROM (
            SELECT unnest(jr.tags) AS unnested_tag
            FROM ${jobRunsTable} jr
          ) AS unnested_tags
          WHERE unnested_tag ILIKE ${`%${search}%`}
          ORDER BY unnested_tag
          LIMIT 100
        `
        : sql`
          SELECT DISTINCT unnested_tag AS tag
          FROM (
            SELECT unnest(jr.tags) AS unnested_tag
            FROM ${jobRunsTable} jr
          ) AS unnested_tags
          ORDER BY unnested_tag
          LIMIT 100
        `,
    );

    return {
      tags: (tags.rows as { tag: string }[])
        .map((row) => row.tag)
        .filter(Boolean),
    };
  },
});
