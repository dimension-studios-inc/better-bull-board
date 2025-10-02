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
  jobs: z.array(
    jobRunDataSchema.pick({
      id: true,
      job_id: true,
      queue: true,
      name: true,
      status: true,
      attempt: true,
      max_attempts: true,
      created_at: true,
      enqueued_at: true,
      started_at: true,
      finished_at: true,
      error_message: true,
      tags: true,
    }),
  ),
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
