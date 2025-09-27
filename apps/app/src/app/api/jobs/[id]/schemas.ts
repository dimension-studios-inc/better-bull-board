import { jobRunsSelectSchema } from "@better-bull-board/db";
import z from "zod";
import { registerApiRoute } from "~/lib/utils/client";

export const getJobByIdInput = z.object({
  id: z.string(),
});

export const getJobByIdOutput = z.object({
  job: jobRunsSelectSchema
    .omit({
      backoff: true,
      data: true,
      result: true,
    })
    .extend({
      backoff: z.unknown(),
      data: z.unknown(),
      result: z.unknown(),
    }),
});

export const getJobByIdApiRoute = registerApiRoute({
  route: (input) => `/api/jobs/${input.id}`,
  method: "GET",
  inputSchema: getJobByIdInput,
  outputSchema: getJobByIdOutput,
});
