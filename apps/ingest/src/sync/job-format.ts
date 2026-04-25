import { jobRunsInsertSchema } from "@better-bull-board/db/schemas/job/schema";
import type { Job } from "bullmq";
import { z } from "zod/v4";

export const jobSyncEventSchema = z.object({
  version: z.literal(1),
  eventId: z.string().optional(),
  workerId: z.string().optional(),
  queueName: z.string(),
  phase: z.enum(["waiting", "active", "terminal", "snapshot"]).default("snapshot"),
  state: z
    .enum(["active", "completed", "failed", "waiting", "delayed", "prioritized", "waiting-children", "unknown"])
    .optional(),
  tags: z.array(z.string()).optional(),
  job: z.record(z.string(), z.unknown()),
});

export type JobSyncEvent = z.infer<typeof jobSyncEventSchema>;
export type JobRunInsert = z.infer<typeof jobRunsInsertSchema>;
export type JobSnapshot = ReturnType<Job["toJSON"]>;
export type PersistedJobStatus = JobRunInsert["status"];

const terminalStatuses = new Set<PersistedJobStatus>(["completed", "failed"]);

export const isTerminalStatus = (status: PersistedJobStatus) => terminalStatuses.has(status);

export const bullStateToPersistedStatus = (state?: string): PersistedJobStatus | undefined => {
  switch (state) {
    case "completed":
    case "failed":
    case "active":
    case "waiting":
    case "delayed":
    case "prioritized":
    case "waiting-children":
      return state;
    case "wait":
    case "paused":
      return "waiting";
    default:
      return undefined;
  }
};

export const getStatusFromSnapshot = ({
  job,
  phase,
  state,
}: {
  job: JobSnapshot;
  phase?: JobSyncEvent["phase"];
  state?: string;
}): PersistedJobStatus => {
  const persistedState = bullStateToPersistedStatus(state);
  if (persistedState) return persistedState;
  if (job.finishedOn) return job.failedReason ? "failed" : "completed";
  if (phase === "waiting") return "waiting";
  return "active";
};

export const formatJobRun = ({
  job,
  queueName,
  workerId,
  tags,
  phase,
  state,
}: {
  job: JobSnapshot;
  queueName: string;
  workerId?: string;
  tags?: string[];
  phase?: JobSyncEvent["phase"];
  state?: string;
}) => {
  if (!job.id) {
    throw new Error("Job ID is required");
  }

  const formatted: JobRunInsert = {
    workerId,
    jobId: job.id,
    queue: queueName,
    status: getStatusFromSnapshot({ job, phase, state }),
    attempt: job.attemptsMade,
    maxAttempts: job.opts.attempts,
    priority: job.opts.priority,
    delayMs: job.opts.delay,
    backoff: job.opts.backoff,
    data: job.data,
    enqueuedAt: new Date(job.timestamp),
    startedAt: job.processedOn ? new Date(job.processedOn) : undefined,
    finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
    errorMessage: job.failedReason,
    errorStack: job.stacktrace?.join("\n"),
    name: job.name,
    parentJobId: job.opts.parent?.id,
    repeatJobKey: job.repeatJobKey,
    result: job.returnvalue,
    tags,
    createdAt: new Date(),
  };

  return jobRunsInsertSchema.parse(formatted);
};

export const parseJobSyncEvent = (raw: string) => {
  const parsed = jobSyncEventSchema.parse(JSON.parse(raw));
  return {
    ...parsed,
    job: parsed.job as JobSnapshot,
  };
};
