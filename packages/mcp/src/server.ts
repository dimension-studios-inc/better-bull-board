import {
  getJobByIdInputSchema,
  getJobByIdOutputSchema,
  listJobLogsInputSchema,
  listJobLogsOutputSchema,
  listJobsInputSchema,
  type listJobsOutputSchema,
} from "@better-bull-board/core/job-schemas";
import { getJobById, listJobLogs, listJobs } from "@better-bull-board/core/jobs";
import {
  jobMutationInputSchema,
  mutationResultSchema,
  queueMutationInputSchema,
} from "@better-bull-board/core/mutation-schemas";
import { getSystemOverview, systemOverviewSchema } from "@better-bull-board/core/overview";
import { listQueues, listQueuesInputSchema, listQueuesOutputSchema } from "@better-bull-board/core/queues";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { cancelJob, deleteQueue, pauseQueue, replayJob, resumeQueue } from "./actions";
import { MCP_READ_SCOPE, MCP_WRITE_SCOPE } from "./scopes";

const emptyInputSchema = z.object({}).strict();

type BetterBullBoardMcpServerOptions = {
  scopes?: string[];
};

const defaultScopes = [MCP_READ_SCOPE, MCP_WRITE_SCOPE];

const mcpListJobsOutputSchema = z.object({
  jobs: z.array(
    z.object({
      id: z.string(),
      jobId: z.string(),
      queue: z.string(),
      name: z.string().nullable(),
      status: z.string(),
      attempt: z.number(),
      maxAttempts: z.number(),
      createdAt: z.number(),
      enqueuedAt: z.number().nullable(),
      startedAt: z.number().nullable(),
      finishedAt: z.number().nullable(),
      durationMs: z.number().nullable(),
      errorMessage: z.string().nullable(),
      tags: z.array(z.string()).nullable(),
    }),
  ),
  nextCursor: z
    .object({
      createdAt: z.number(),
      jobId: z.string(),
      id: z.string(),
      durationMs: z.number().nullable().optional(),
    })
    .nullable(),
  prevCursor: z
    .object({
      createdAt: z.number(),
      jobId: z.string(),
      id: z.string(),
      durationMs: z.number().nullable().optional(),
    })
    .nullable(),
});

const toTimestamp = (value: Date | null) => value?.getTime() ?? null;

const serializeListJobs = (result: z.infer<typeof listJobsOutputSchema>): z.infer<typeof mcpListJobsOutputSchema> => ({
  jobs: result.jobs.map((job) => ({
    ...job,
    createdAt: job.createdAt.getTime(),
    enqueuedAt: toTimestamp(job.enqueuedAt),
    startedAt: toTimestamp(job.startedAt),
    finishedAt: toTimestamp(job.finishedAt),
  })),
  nextCursor: result.nextCursor
    ? {
        ...result.nextCursor,
        createdAt: result.nextCursor.createdAt.getTime(),
      }
    : null,
  prevCursor: result.prevCursor
    ? {
        ...result.prevCursor,
        createdAt: result.prevCursor.createdAt.getTime(),
      }
    : null,
});

const formatOverview = (overview: z.infer<typeof systemOverviewSchema>) =>
  [
    "# Better Bull Board System Overview",
    "",
    `- Active jobs: ${overview.activeJobs}`,
    `- Waiting jobs: ${overview.waitingJobs}`,
    `- Total queues: ${overview.totalQueues}`,
    `- Active queues: ${overview.activeQueues}`,
    `- Queues with schedulers: ${overview.queuesWithSchedulers}`,
  ].join("\n");

const formatQueues = (result: z.infer<typeof listQueuesOutputSchema>) =>
  [
    "# Better Bull Board Queues",
    "",
    `Total matching queues: ${result.total}`,
    result.nextCursor ? "Next page available: yes" : "Next page available: no",
    "",
    ...result.queues.map(
      (queue) =>
        `- ${queue.name}: ${queue.waitingJobs} waiting, ${queue.activeJobs} active, ${
          queue.isPaused ? "paused" : "running"
        }`,
    ),
  ].join("\n");

const formatJobs = (result: z.infer<typeof listJobsOutputSchema>) =>
  [
    "# Better Bull Board Jobs",
    "",
    result.nextCursor ? "Next page available: yes" : "Next page available: no",
    "",
    ...result.jobs.map((job) =>
      [
        `- ${job.id}`,
        `  jobId: ${job.jobId}`,
        `  queue: ${job.queue}`,
        `  name: ${job.name ?? "(none)"}`,
        `  status: ${job.status}`,
        `  createdAt: ${job.createdAt.toISOString()}`,
        job.durationMs === null ? undefined : `  durationMs: ${job.durationMs}`,
        job.errorMessage ? `  error: ${job.errorMessage}` : undefined,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ].join("\n");

const formatJob = (result: z.infer<typeof getJobByIdOutputSchema>) => {
  const { job } = result;

  if (!job) {
    return "Job run not found.";
  }

  return [
    "# Better Bull Board Job",
    "",
    `id: ${job.id}`,
    `jobId: ${job.jobId}`,
    `queue: ${job.queue}`,
    `name: ${job.name ?? "(none)"}`,
    `status: ${job.status}`,
    `attempt: ${job.attempt}/${job.maxAttempts}`,
    `createdAt: ${new Date(job.createdAt).toISOString()}`,
    job.enqueuedAt ? `enqueuedAt: ${new Date(job.enqueuedAt).toISOString()}` : undefined,
    job.startedAt ? `startedAt: ${new Date(job.startedAt).toISOString()}` : undefined,
    job.finishedAt ? `finishedAt: ${new Date(job.finishedAt).toISOString()}` : undefined,
    job.durationMs === null ? undefined : `durationMs: ${job.durationMs}`,
    job.errorMessage ? `error: ${job.errorMessage}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
};

const formatLogs = (result: z.infer<typeof listJobLogsOutputSchema>) =>
  [
    "# Better Bull Board Job Logs",
    "",
    `Total matching logs: ${result.total}`,
    "",
    ...result.logs.map((log) => `- ${new Date(log.ts).toISOString()} [${log.level}] #${log.logSeq}: ${log.message}`),
  ].join("\n");

const formatMutationResult = (title: string, result: z.infer<typeof mutationResultSchema>) =>
  [`# ${title}`, "", result.message].join("\n");

export const createBetterBullBoardMcpServer = (options: BetterBullBoardMcpServerOptions = {}) => {
  const scopes = new Set(options.scopes ?? defaultScopes);
  const requireWriteAccess = () => {
    if (!scopes.has(MCP_WRITE_SCOPE)) {
      throw new Error("This MCP access token does not include the bbb:write scope required for this tool.");
    }
  };

  const server = new McpServer({
    name: "better-bull-board-mcp-server",
    version: "0.1.0",
  });

  server.registerTool(
    "bbb_get_system_overview",
    {
      title: "Get Better Bull Board System Overview",
      description:
        "Read a high-level Better Bull Board overview with active job count, waiting job count, total queues, active queues, and queues with schedulers. This tool is read-only and does not inspect job payloads or logs.",
      inputSchema: emptyInputSchema,
      outputSchema: systemOverviewSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const overview = await getSystemOverview();

      return {
        content: [{ type: "text", text: formatOverview(overview) }],
        structuredContent: overview,
      };
    },
  );

  server.registerTool(
    "bbb_list_queues",
    {
      title: "List Better Bull Board Queues",
      description:
        "List queues with waiting and active job counts. Supports search, cursor pagination, and a maximum page size of 100.",
      inputSchema: listQueuesInputSchema,
      outputSchema: listQueuesOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      const result = await listQueues(input);

      return {
        content: [{ type: "text", text: formatQueues(result) }],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    "bbb_list_jobs",
    {
      title: "List Better Bull Board Jobs",
      description:
        "List job runs with filters for queue, status, tags, search text, created date bounds, sorting, and cursor pagination. This does not return job payload data.",
      inputSchema: listJobsInputSchema,
      outputSchema: mcpListJobsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      const result = await listJobs(input);
      const serializedResult = serializeListJobs(result);

      return {
        content: [{ type: "text", text: formatJobs(result) }],
        structuredContent: serializedResult,
      };
    },
  );

  server.registerTool(
    "bbb_get_job",
    {
      title: "Get Better Bull Board Job",
      description:
        "Read one job run by Better Bull Board run id, including payload/result/error fields when present. Use bbb_list_jobs first when you only know a queue or BullMQ job id.",
      inputSchema: getJobByIdInputSchema,
      outputSchema: getJobByIdOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      const result = await getJobById(input);

      return {
        content: [{ type: "text", text: formatJob(result) }],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    "bbb_list_job_logs",
    {
      title: "List Better Bull Board Job Logs",
      description:
        "List logs for a Better Bull Board job run id. Supports level filtering, message substring search, limit, and offset pagination.",
      inputSchema: listJobLogsInputSchema,
      outputSchema: listJobLogsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      const result = await listJobLogs(input);

      return {
        content: [{ type: "text", text: formatLogs(result) }],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    "bbb_cancel_job",
    {
      title: "Cancel Better Bull Board Job",
      description:
        "Cancel a BullMQ job by queue name and BullMQ job id, then mark the tracked job run as failed when it has not already completed or failed. Requires bbb:write.",
      inputSchema: jobMutationInputSchema,
      outputSchema: mutationResultSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      requireWriteAccess();
      const result = await cancelJob(input);

      return {
        content: [{ type: "text", text: formatMutationResult("Better Bull Board Job Cancelled", result) }],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    "bbb_replay_job",
    {
      title: "Replay Better Bull Board Job",
      description:
        "Replay a BullMQ job by queue name and BullMQ job id. Retries the job when possible, otherwise enqueues a new copy from the Redis job payload/options. Requires bbb:write.",
      inputSchema: jobMutationInputSchema,
      outputSchema: mutationResultSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      requireWriteAccess();
      const result = await replayJob(input);

      return {
        content: [{ type: "text", text: formatMutationResult("Better Bull Board Job Replayed", result) }],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    "bbb_pause_queue",
    {
      title: "Pause Better Bull Board Queue",
      description: "Pause a BullMQ queue by queue name and update the tracked queue state. Requires bbb:write.",
      inputSchema: queueMutationInputSchema,
      outputSchema: mutationResultSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      requireWriteAccess();
      const result = await pauseQueue(input);

      return {
        content: [{ type: "text", text: formatMutationResult("Better Bull Board Queue Paused", result) }],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    "bbb_resume_queue",
    {
      title: "Resume Better Bull Board Queue",
      description: "Resume a BullMQ queue by queue name and update the tracked queue state. Requires bbb:write.",
      inputSchema: queueMutationInputSchema,
      outputSchema: mutationResultSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      requireWriteAccess();
      const result = await resumeQueue(input);

      return {
        content: [{ type: "text", text: formatMutationResult("Better Bull Board Queue Resumed", result) }],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    "bbb_delete_queue",
    {
      title: "Delete Better Bull Board Queue",
      description:
        "Permanently obliterate a BullMQ queue by queue name and remove the tracked queue row. This is destructive and requires bbb:write.",
      inputSchema: queueMutationInputSchema,
      outputSchema: mutationResultSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      requireWriteAccess();
      const result = await deleteQueue(input);

      return {
        content: [{ type: "text", text: formatMutationResult("Better Bull Board Queue Deleted", result) }],
        structuredContent: result,
      };
    },
  );

  return server;
};
