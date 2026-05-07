import { db } from "@better-bull-board/db/server";
import { sql } from "drizzle-orm";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getTagsApiRoute } from "./schemas";

const MIN_TAG_SEARCH_LENGTH = 2;

export const POST = createAuthenticatedApiRoute({
  apiRoute: getTagsApiRoute,
  async handler(input) {
    const search = input.search?.trim();

    if (!search || search.length < MIN_TAG_SEARCH_LENGTH) {
      return { tags: [] };
    }

    const normalizedSearch = search.toLowerCase();
    const prefixSearch = `${normalizedSearch}%`;
    const containsSearch = `%${normalizedSearch}%`;
    const searchPattern = normalizedSearch.length === 2 ? prefixSearch : containsSearch;

    const tags = await db.execute(sql`
      SELECT "tag"
      FROM "job_tags"
      WHERE "tag_lower" LIKE ${searchPattern}
      ORDER BY
        CASE WHEN "tag_lower" LIKE ${prefixSearch} THEN 0 ELSE 1 END,
        "tag"
      LIMIT 100
    `);

    return {
      tags: (tags.rows as { tag: string }[]).map((row) => row.tag).filter(Boolean),
    };
  },
});
