import { listJobsInputSchema, listJobsOutputSchema } from "@better-bull-board/core/jobs";
import { registerApiRoute } from "~/lib/utils/client";

export const getJobsTableInput = listJobsInputSchema;
export const getJobsTableOutput = listJobsOutputSchema;

export const getJobsTableApiRoute = registerApiRoute({
  route: "/api/jobs/table",
  method: "POST",
  inputSchema: getJobsTableInput,
  outputSchema: getJobsTableOutput,
});
