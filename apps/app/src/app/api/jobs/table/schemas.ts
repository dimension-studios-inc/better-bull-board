import { jobRunDataSchema } from "@better-bull-board/clickhouse/schemas";
import z from "zod";
import { registerApiRoute } from "~/lib/utils/client";

export const getJobsTableInput = z.object({
  cursor: z
    .object({
      created_at: z.number(),
      job_id: z.string(),
      id: z.string(),
    })
    .nullish(),
  search: z.string().optional(),
  status: z.string().optional(),
  queue: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().min(1).max(100).optional(),
});

export const getJobsTableOutput = z.object({
  jobs: z.array(jobRunDataSchema),
  nextCursor: z
    .object({
      created_at: z.number(),
      job_id: z.string(),
      id: z.string(),
    })
    .nullable(),
  prevCursor: z
    .object({
      created_at: z.number(),
      job_id: z.string(),
      id: z.string(),
    })
    .nullable(),
});

export const getJobsTableApiRoute = registerApiRoute({
  route: "/api/jobs/table",
  method: "POST",
  inputSchema: getJobsTableInput,
  outputSchema: getJobsTableOutput,
});
