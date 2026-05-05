import z from "zod";
import { registerApiRoute } from "~/lib/utils/client";

export const getJobsTableInput = z.object({
  cursor: z
    .object({
      createdAt: z.number(),
      jobId: z.string(),
      id: z.string(),
      durationMs: z.number().nullable().optional(),
    })
    .nullish(),
  cursorDirection: z.enum(["next", "prev"]).optional(),
  search: z.string().optional(),
  status: z.string().optional(),
  queue: z.string().optional(),
  tags: z.array(z.string()).optional(),
  createdFrom: z.string().optional(),
  createdTo: z.string().optional(),
  sortBy: z.enum(["createdAt", "durationMs"]).optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
  limit: z.number().min(1).max(100).optional(),
});

export const getJobsTableOutput = z.object({
  jobs: z.array(
    z.object({
      id: z.string(),
      jobId: z.string(),
      queue: z.string(),
      name: z.string().nullable(),
      status: z.string(),
      attempt: z.number(),
      maxAttempts: z.number(),
      createdAt: z.coerce.date(),
      enqueuedAt: z.coerce.date().nullable(),
      startedAt: z.coerce.date().nullable(),
      finishedAt: z.coerce.date().nullable(),
      durationMs: z.number().nullable(),
      errorMessage: z.string().nullable(),
      tags: z.array(z.string()).nullable(),
    }),
  ),
  nextCursor: z
    .object({
      createdAt: z.coerce.date(),
      jobId: z.string(),
      id: z.string(),
      durationMs: z.number().nullable().optional(),
    })
    .nullable(),
  prevCursor: z
    .object({
      createdAt: z.coerce.date(),
      jobId: z.string(),
      id: z.string(),
      durationMs: z.number().nullable().optional(),
    })
    .nullable(),
});

export const getJobsTableApiRoute = registerApiRoute({
  route: "/api/jobs/table",
  method: "POST",
  inputSchema: getJobsTableInput,
  outputSchema: getJobsTableOutput,
});
