import { getJobById } from "@better-bull-board/core";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getJobByIdApiRoute } from "./schemas";

export const GET = createAuthenticatedApiRoute({
  apiRoute: getJobByIdApiRoute,
  async handler(_input, _req, ctx) {
    const { id } = await ctx.params;
    const result = await getJobById({ id });

    if (!result.job) {
      throw new Error("Job run not found");
    }

    return result;
  },
});
