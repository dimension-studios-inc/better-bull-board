import { z } from "zod";

const jobStatusValues = [
  "active",
  "completed",
  "failed",
  "waiting",
  "delayed",
  "prioritized",
  "waiting-children",
  "unknown",
] as const;

const logLevelValues = ["log", "debug", "info", "warn", "error"] as const;

export const listJobsInputSchema = z.object({
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

export const listJobsOutputSchema = z.object({
  jobs: z.array(
    z.object({
      id: z.string(),
      jobId: z.string(),
      queue: z.string(),
      name: z.string().nullable(),
      status: z.enum(jobStatusValues),
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

export const getJobByIdInputSchema = z.object({
  id: z.string(),
});

export const getJobByIdOutputSchema = z.object({
  job: z.object({
    id: z.string(),
    jobId: z.string(),
    queue: z.string(),
    name: z.string().nullable(),
    status: z.enum(jobStatusValues),
    attempt: z.number(),
    maxAttempts: z.number(),
    priority: z.number().nullable(),
    delayMs: z.number(),
    backoff: z.unknown(),
    repeatJobKey: z.string().nullable(),
    parentJobId: z.string().nullable(),
    workerId: z.string().nullable(),
    tags: z.array(z.string()).nullable(),
    data: z.unknown(),
    result: z.unknown(),
    errorMessage: z.string().nullable(),
    errorStack: z.string().nullable(),
    createdAt: z.number(),
    enqueuedAt: z.number().nullable(),
    startedAt: z.number().nullable(),
    finishedAt: z.number().nullable(),
    durationMs: z.number().nullable(),
  }),
});

export const listJobLogsInputSchema = z.object({
  id: z.string(),
  level: z.enum(logLevelValues).optional(),
  messageContains: z.string().optional(),
  limit: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
});

export const listJobLogsOutputSchema = z.object({
  logs: z.array(
    z.object({
      id: z.string(),
      jobRunId: z.string(),
      level: z.string(),
      message: z.string(),
      logSeq: z.number(),
      ts: z.number(),
    }),
  ),
  total: z.number(),
});
