import { getJobByIdInputSchema, getJobByIdOutputSchema } from "@better-bull-board/core/job-schemas";
import { registerApiRoute } from "~/lib/utils/client";

export const getJobByIdApiRoute = registerApiRoute({
  route: (input) => `/api/jobs/${input.id}`,
  method: "GET",
  urlSchema: getJobByIdInputSchema,
  outputSchema: getJobByIdOutputSchema,
});
