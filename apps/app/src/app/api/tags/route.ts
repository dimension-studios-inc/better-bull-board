import { clickhouseClient } from "@better-bull-board/clickhouse/client";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getTagsApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getTagsApiRoute,
  async handler(input) {
    const { search } = input;

    // Query to get distinct tags from job runs
    const query = `
      SELECT DISTINCT arrayJoin(tags) as tag
      FROM job_runs_ch FINAL
      WHERE tag != ''
      ${search ? "AND tag ILIKE {search:String}" : ""}
      ORDER BY tag
      LIMIT 100
    `;

    const params = search ? { search: `%${search}%` } : {};

    const result = await clickhouseClient.query({
      query,
      query_params: params,
      format: "JSONEachRow",
    });

    const tags = await result.json<{ tag: string }>();

    return {
      tags: tags.map((row) => row.tag),
    };
  },
});
