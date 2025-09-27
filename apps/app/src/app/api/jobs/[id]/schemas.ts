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
      createdAt: true,
      enqueuedAt: true,
      startedAt: true,
      finishedAt: true,
    })
    .extend({
      backoff: z.unknown(),
      data: z.unknown(),
      result: z.unknown(),
      createdAt: z.number(),
      enqueuedAt: z.number().nullable(),
      startedAt: z.number().nullable(),
      finishedAt: z.number().nullable(),
    }),
});

export const getJobByIdApiRoute = registerApiRoute({
  route: (input) => `/api/jobs/${input.id}`,
  method: "GET",
  urlSchema: getJobByIdInput,
  outputSchema: getJobByIdOutput,
});
