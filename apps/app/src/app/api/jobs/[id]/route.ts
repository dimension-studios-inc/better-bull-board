import { jobRunsTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { eq } from "drizzle-orm";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getJobByIdApiRoute } from "./schemas";

export const GET = createAuthenticatedApiRoute({
  apiRoute: getJobByIdApiRoute,
  async handler(_input, _req, ctx) {
    const { id } = await ctx.params;

    const [jobRun] = await db.select().from(jobRunsTable).where(eq(jobRunsTable.id, id));
    if (!jobRun) {
      throw new Error("Job run not found");
    }
    return {
      job: {
        ...jobRun,
        createdAt: jobRun.createdAt.getTime(),
        enqueuedAt: jobRun.enqueuedAt?.getTime() ?? null,
        startedAt: jobRun.startedAt?.getTime() ?? null,
        finishedAt: jobRun.finishedAt?.getTime() ?? null,
      },
    };
  },
});
