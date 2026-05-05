import { jobRunsTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { sql } from "drizzle-orm";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getTagsApiRoute } from "./schemas";

const MIN_TAG_SEARCH_LENGTH = 3;

export const POST = createAuthenticatedApiRoute({
  apiRoute: getTagsApiRoute,
  async handler(input) {
    const search = input.search?.trim();

    if (!search || search.length < MIN_TAG_SEARCH_LENGTH) {
      return { tags: [] };
    }

    const tags = await db.execute(
      sql`
          WITH matching_runs AS (
            SELECT jr.tags
            FROM ${jobRunsTable} jr
            WHERE cardinality(jr.tags) > 0
              AND public.job_runs_tags_search_text(jr.tags) ILIKE ${`%${search}%`}
          )
          SELECT DISTINCT unnested_tags.tag
          FROM matching_runs
          CROSS JOIN LATERAL unnest(matching_runs.tags) AS unnested_tags(tag)
          WHERE unnested_tags.tag ILIKE ${`%${search}%`}
          ORDER BY unnested_tags.tag
          LIMIT 100
        `,
    );

    return {
      tags: (tags.rows as { tag: string }[]).map((row) => row.tag).filter(Boolean),
    };
  },
});
