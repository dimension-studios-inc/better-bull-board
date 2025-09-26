import { jobRunDataSchema } from "@better-bull-board/clickhouse/schemas";
import z from "zod";
import { registerApiRoute } from "~/lib/utils/server";

export const getJobsTableInput = z.object({
  cursor: z.string().nullish(),
  search: z.string().optional(),
  status: z.string().optional(),
  queue: z.string().optional(),
  limit: z.number().min(1).max(100).optional(),
});

export const getJobsTableOutput = z.object({
  jobs: z.array(jobRunDataSchema),
  nextCursor: z.string().nullable(),
});

export const getJobsTableApiRoute = registerApiRoute({
  route: "/api/jobs/table",
  method: "POST",
  inputSchema: getJobsTableInput,
  outputSchema: getJobsTableOutput,
});
