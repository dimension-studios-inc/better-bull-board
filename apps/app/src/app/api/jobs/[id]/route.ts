import { jobRunsTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { eq } from "drizzle-orm";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getJobByIdApiRoute } from "./schemas";

export const GET = createAuthenticatedApiRoute({
  apiRoute: getJobByIdApiRoute,
  async handler(input) {
    const [jobRun] = await db
      .select()
      .from(jobRunsTable)
      .where(eq(jobRunsTable.id, input.id));
    if (!jobRun) {
      throw new Error("Job run not found");
    }
    return { job: jobRun };
  },
});
