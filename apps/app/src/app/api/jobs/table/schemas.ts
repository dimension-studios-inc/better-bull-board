import { listJobsInputSchema, listJobsOutputSchema } from "@better-bull-board/core/job-schemas";
import { registerApiRoute } from "~/lib/utils/client";

export const getJobsTableApiRoute = registerApiRoute({
  route: "/api/jobs/table",
  method: "POST",
  inputSchema: listJobsInputSchema,
  outputSchema: listJobsOutputSchema,
});
