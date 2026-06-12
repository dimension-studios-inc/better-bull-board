import { jobLogsTable, jobRunsTable, jobStatusEnum, logLevelEnum } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { and, arrayOverlaps, asc, desc, eq, gt, gte, ilike, lt, lte, or, sql } from "drizzle-orm";
import { z } from "zod";

type CursorDirection = "next" | "prev";
type SortBy = "createdAt" | "durationMs";
type SortDirection = "asc" | "desc";
type JobCursor = { createdAt: Date; jobId: string; id: string; durationMs?: number | null };

const jobTableColumns = {
  id: jobRunsTable.id,
  jobId: jobRunsTable.jobId,
  queue: jobRunsTable.queue,
  name: jobRunsTable.name,
  status: jobRunsTable.status,
  attempt: jobRunsTable.attempt,
  maxAttempts: jobRunsTable.maxAttempts,
  createdAt: jobRunsTable.createdAt,
  enqueuedAt: jobRunsTable.enqueuedAt,
  startedAt: jobRunsTable.startedAt,
  finishedAt: jobRunsTable.finishedAt,
  durationMs: jobRunsTable.durationMs,
  errorMessage: jobRunsTable.errorMessage,
  tags: jobRunsTable.tags,
};

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
      status: z.enum(jobStatusEnum.enumValues),
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
    status: z.enum(jobStatusEnum.enumValues),
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
  level: z.enum(logLevelEnum.enumValues).optional(),
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

const parseCreatedBoundary = ({
  fallbackTime,
  isUpperBoundary = false,
  value,
}: {
  fallbackTime: string;
  isUpperBoundary?: boolean;
  value: string;
}) => {
  const valueWithTime = value.includes("T") ? value : `${value}T${fallbackTime}`;
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(valueWithTime);
  const date = new Date(hasTimezone ? valueWithTime : `${valueWithTime}Z`);

  if (isUpperBoundary && /T\d{2}:\d{2}$/.test(value)) {
    date.setSeconds(59, 999);
  }

  return date;
};

const toCursor = (job: JobCursor) => ({
  createdAt: job.createdAt,
  jobId: job.jobId,
  id: job.id,
  durationMs: job.durationMs ?? null,
});

const getOrderDirection = (cursorDirection: CursorDirection, sortDirection: SortDirection) => {
  if (cursorDirection === "next") return sortDirection;
  return sortDirection === "desc" ? "asc" : "desc";
};

const getSortOrder = ({
  cursorDirection,
  durationSortExpression,
  sortBy,
  sortDirection,
}: {
  cursorDirection: CursorDirection;
  durationSortExpression: ReturnType<typeof sql<number>>;
  sortBy: SortBy;
  sortDirection: SortDirection;
}) => {
  const orderDirection = getOrderDirection(cursorDirection, sortDirection);

  if (sortBy === "durationMs") {
    return orderDirection === "desc"
      ? [desc(durationSortExpression), desc(jobRunsTable.createdAt), desc(jobRunsTable.jobId), desc(jobRunsTable.id)]
      : [asc(durationSortExpression), asc(jobRunsTable.createdAt), asc(jobRunsTable.jobId), asc(jobRunsTable.id)];
  }

  return orderDirection === "desc"
    ? [desc(jobRunsTable.createdAt), desc(jobRunsTable.jobId), desc(jobRunsTable.id)]
    : [asc(jobRunsTable.createdAt), asc(jobRunsTable.jobId), asc(jobRunsTable.id)];
};

const getCreatedAtCursorComparison = ({
  createdAt,
  id,
  jobId,
  useLessThan,
}: {
  createdAt: Date;
  id: string;
  jobId: string;
  useLessThan: boolean;
}) =>
  useLessThan
    ? or(
        lt(jobRunsTable.createdAt, createdAt),
        and(eq(jobRunsTable.createdAt, createdAt), lt(jobRunsTable.jobId, jobId)),
        and(eq(jobRunsTable.createdAt, createdAt), eq(jobRunsTable.jobId, jobId), lt(jobRunsTable.id, id)),
      )
    : or(
        gt(jobRunsTable.createdAt, createdAt),
        and(eq(jobRunsTable.createdAt, createdAt), gt(jobRunsTable.jobId, jobId)),
        and(eq(jobRunsTable.createdAt, createdAt), eq(jobRunsTable.jobId, jobId), gt(jobRunsTable.id, id)),
      );

const getCursorComparison = ({
  cursor,
  cursorDirection,
  durationSortExpression,
  sortBy,
  sortDirection,
}: {
  cursor: { createdAt: number; jobId: string; id: string; durationMs?: number | null };
  cursorDirection: CursorDirection;
  durationSortExpression: ReturnType<typeof sql<number>>;
  sortBy: SortBy;
  sortDirection: SortDirection;
}) => {
  const createdAt = new Date(cursor.createdAt);
  const useLessThan = cursorDirection === "next" ? sortDirection === "desc" : sortDirection === "asc";
  const createdAtComparison = getCreatedAtCursorComparison({
    createdAt,
    id: cursor.id,
    jobId: cursor.jobId,
    useLessThan,
  });

  if (sortBy !== "durationMs") {
    return createdAtComparison;
  }

  const durationMs = cursor.durationMs ?? 0;
  return or(
    useLessThan ? lt(durationSortExpression, durationMs) : gt(durationSortExpression, durationMs),
    and(eq(durationSortExpression, durationMs), createdAtComparison),
  );
};

export const listJobs = async (input: z.input<typeof listJobsInputSchema> = {}) => {
  const parsed = listJobsInputSchema.parse(input);
  const { cursor, cursorDirection = "next", search, queue, status, tags, createdFrom, createdTo } = parsed;
  const limit = parsed.limit ?? 20;
  const sortBy = parsed.sortBy ?? "createdAt";
  const sortDirection = parsed.sortDirection ?? "desc";
  const durationSortExpression = sql<number>`COALESCE(${jobRunsTable.durationMs}, 0)`;

  const conditions = [];

  if (search) {
    const searchConditions = [
      ilike(jobRunsTable.name, `%${search}%`),
      ilike(jobRunsTable.queue, `%${search}%`),
      ilike(jobRunsTable.jobId, `%${search}%`),
      ilike(jobRunsTable.errorMessage, `%${search}%`),
    ];
    if (z.uuid().safeParse(search).success) {
      searchConditions.push(eq(jobRunsTable.id, search));
    }
    conditions.push(or(...searchConditions));
  }

  if (queue && queue !== "all") {
    conditions.push(eq(jobRunsTable.queue, queue));
  }

  if (
    status &&
    status !== "all" &&
    jobStatusEnum.enumValues.includes(status as (typeof jobStatusEnum.enumValues)[number])
  ) {
    conditions.push(eq(jobRunsTable.status, status as (typeof jobStatusEnum.enumValues)[number]));
  }

  if (tags && tags.length > 0) {
    conditions.push(arrayOverlaps(jobRunsTable.tags, tags));
  }

  if (createdFrom) {
    conditions.push(gte(jobRunsTable.createdAt, parseCreatedBoundary({ value: createdFrom, fallbackTime: "00:00" })));
  }

  if (createdTo) {
    conditions.push(
      lte(
        jobRunsTable.createdAt,
        parseCreatedBoundary({ value: createdTo, fallbackTime: "23:59:59.999", isUpperBoundary: true }),
      ),
    );
  }

  if (cursor) {
    conditions.push(
      getCursorComparison({
        cursor,
        cursorDirection,
        durationSortExpression,
        sortBy,
        sortDirection,
      }),
    );
  }

  const rows = await db
    .select(jobTableColumns)
    .from(jobRunsTable)
    .where(and(...conditions))
    .orderBy(
      ...getSortOrder({
        cursorDirection,
        durationSortExpression,
        sortBy,
        sortDirection,
      }),
    )
    .limit(limit + 1);

  const hasExtra = rows.length > limit;

  if (hasExtra) {
    rows.pop();
  }

  const jobs = cursorDirection === "prev" ? rows.reverse() : rows;
  const firstJob = jobs[0];
  const lastJob = jobs.at(-1);
  const hasNewerPage = cursorDirection === "next" ? Boolean(cursor) : hasExtra;
  const hasOlderPage = cursorDirection === "prev" ? Boolean(cursor) : hasExtra;

  return listJobsOutputSchema.parse({
    jobs,
    nextCursor: hasOlderPage && lastJob ? toCursor(lastJob) : null,
    prevCursor: hasNewerPage && firstJob ? toCursor(firstJob) : null,
  });
};

export const getJobById = async (input: z.input<typeof getJobByIdInputSchema>) => {
  const { id } = getJobByIdInputSchema.parse(input);
  const [jobRun] = await db.select().from(jobRunsTable).where(eq(jobRunsTable.id, id));

  if (!jobRun) {
    throw new Error("Job run not found");
  }

  return getJobByIdOutputSchema.parse({
    job: {
      ...jobRun,
      createdAt: jobRun.createdAt.getTime(),
      enqueuedAt: jobRun.enqueuedAt?.getTime() ?? null,
      startedAt: jobRun.startedAt?.getTime() ?? null,
      finishedAt: jobRun.finishedAt?.getTime() ?? null,
    },
  });
};

export const listJobLogs = async (input: z.input<typeof listJobLogsInputSchema>) => {
  const { id, level, messageContains, limit = 100, offset = 0 } = listJobLogsInputSchema.parse(input);
  const conditions = [eq(jobLogsTable.jobRunId, id)];

  if (level) {
    conditions.push(eq(jobLogsTable.level, level));
  }

  if (messageContains) {
    conditions.push(ilike(jobLogsTable.message, `%${messageContains}%`));
  }

  const whereClause = and(...conditions);

  const [logs, [countRow]] = await Promise.all([
    db
      .select()
      .from(jobLogsTable)
      .where(whereClause)
      .orderBy(asc(jobLogsTable.ts), asc(jobLogsTable.logSeq))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(jobLogsTable).where(whereClause),
  ]);

  return listJobLogsOutputSchema.parse({
    logs: logs.map((log) => ({
      ...log,
      ts: log.ts.getTime(),
    })),
    total: Number(countRow?.count ?? 0),
  });
};
