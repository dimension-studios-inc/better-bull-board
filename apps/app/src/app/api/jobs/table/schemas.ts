import { jobRunDataSchema } from "@better-bull-board/clickhouse/schemas";
import z from "zod";
import { registerApiRoute } from "~/lib/utils/client";

export const getJobsTableInput = z.object({
  cursor: z.string().nullish(),
  direction: z.enum(['next', 'prev']).optional().default('next'),
  search: z.string().optional(),
  status: z.string().optional(),
  queue: z.string().optional(),
  limit: z.number().min(1).max(100).optional(),
});

export const getJobsTableOutput = z.object({
  jobs: z.array(jobRunDataSchema),
  nextCursor: z.string().nullable(),
  prevCursor: z.string().nullable(),
});

export const getJobsTableApiRoute = registerApiRoute({
  route: "/api/jobs/table",
  method: "POST",
  inputSchema: getJobsTableInput,
  outputSchema: getJobsTableOutput,
});
