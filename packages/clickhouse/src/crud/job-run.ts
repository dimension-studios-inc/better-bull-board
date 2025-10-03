import z from "zod";
import { clickhouseClient } from "../lib/client";
import { type JobRunData, jobRunDataSchema } from "./schemas";

export const upsertJobRun = async (
  _jobRun: Omit<JobRunData, "updated_at">,
): Promise<void> => {
  const jobRun = jobRunDataSchema.omit({ updated_at: true }).parse(_jobRun);
  const formattedRun = {
    ...jobRun,
    created_at: jobRun.created_at.getTime(),
    enqueued_at: jobRun.enqueued_at?.getTime(),
    started_at: jobRun.started_at?.getTime(),
    finished_at: jobRun.finished_at?.getTime(),
  };

  await clickhouseClient.insert({
    table: "job_runs_ch",
    values: [formattedRun],
    format: "JSONEachRow",
  });
};

export const bulkUpsertJobRun = async (
  _jobRuns: { data: Omit<JobRunData, "updated_at"> }[],
): Promise<void> => {
  const jobRuns = jobRunDataSchema
    .omit({ updated_at: true })
    .array()
    .parse(_jobRuns.map((jobRun) => jobRun.data));

  const formattedRuns = jobRuns.map((jobRun) => ({
    ...jobRun,
    created_at: jobRun.created_at.getTime(),
    enqueued_at: jobRun.enqueued_at?.getTime(),
    started_at: jobRun.started_at?.getTime(),
    finished_at: jobRun.finished_at?.getTime(),
  }));

  if (formattedRuns.length > 0) {
    await clickhouseClient.insert({
      table: "job_runs_ch",
      values: formattedRuns,
      format: "JSONEachRow",
    });
  }
};

export const searchJobRuns = async (filters: {
  id?: string;
  jobId?: string;
  queue?: string;
  status?: string;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  search?: string;
  cursor?: { created_at: number; job_id: string; id: string } | null;
  direction?: "asc" | "desc";
}): Promise<
  (Pick<
    JobRunData,
    | "id"
    | "job_id"
    | "queue"
    | "name"
    | "status"
    | "attempt"
    | "max_attempts"
    | "error_message"
    | "tags"
  > & {
    created_at: number;
    enqueued_at: number | null;
    started_at: number | null;
    finished_at: number | null;
    updated_at: number;
  })[]
> => {
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.id) {
    conditions.push("id = {id:UUID}");
    params.id = filters.id;
  }

  if (filters.jobId) {
    conditions.push("job_id = {job_id:String}");
    params.job_id = filters.jobId;
  }

  if (filters.queue) {
    conditions.push("queue = {queue:String}");
    params.queue = filters.queue;
  }

  if (filters.status) {
    conditions.push("status = {status:String}");
    params.status = filters.status;
  }

  if (filters.tags && filters.tags.length > 0) {
    conditions.push("hasAny(tags, {tags:Array(String)})");
    params.tags = filters.tags;
  }

  if (filters.dateFrom) {
    conditions.push("created_at >= {date_from:DateTime64(3, 'UTC')}");
    params.date_from = filters.dateFrom;
  }

  if (filters.dateTo) {
    conditions.push("created_at <= {date_to:DateTime64(3, 'UTC')}");
    params.date_to = filters.dateTo;
  }

  if (filters.search) {
    const baseConditions = [
      "name ILIKE {search:String}",
      "queue ILIKE {search:String}",
      "job_id ILIKE {search:String}",
      "error_message ILIKE {search:String}",
    ];
    if (z.uuid().safeParse(filters.search).success) {
      baseConditions.push("id = {search:UUID}");
    }
    conditions.push(baseConditions.join(" OR "));
    params.search = `%${filters.search}%`;
  }

  if (filters.cursor) {
    const { created_at, job_id, id } = filters.cursor;

    if (filters.direction === "asc") {
      conditions.push(`
      (
        created_at > {cursor_created_at:DateTime64(3, 'UTC')}
        OR (created_at = {cursor_created_at:DateTime64(3, 'UTC')} AND job_id > {cursor_job_id:String})
        OR (created_at = {cursor_created_at:DateTime64(3, 'UTC')} AND job_id = {cursor_job_id:String} AND id > {cursor_id:UUID})
      )
    `);
    } else {
      conditions.push(`
      (
        created_at < {cursor_created_at:DateTime64(3, 'UTC')}
        OR (created_at = {cursor_created_at:DateTime64(3, 'UTC')} AND job_id < {cursor_job_id:String})
        OR (created_at = {cursor_created_at:DateTime64(3, 'UTC')} AND job_id = {cursor_job_id:String} AND id < {cursor_id:UUID})
      )
    `);
    }

    Object.assign(params, {
      cursor_created_at: new Date(created_at),
      cursor_job_id: job_id,
      cursor_id: id,
    });
  }

  const limit = filters.limit || 100;
  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const orderDirection = filters.direction === "asc" ? "ASC" : "DESC";

  const query = `
  SELECT id, job_id, queue, name, status, attempt, max_attempts, created_at, enqueued_at, started_at, finished_at, error_message, tags, updated_at
  FROM job_runs_ch FINAL
  ${whereClause}
  ORDER BY created_at ${orderDirection}, job_id ${orderDirection}, id ${orderDirection}
  LIMIT {limit:UInt32}
`;

  const result = await clickhouseClient.query({
    query,
    query_params: { ...params, limit },
    format: "JSONEachRow",
  });

  const data = (await result.json()) as Pick<
    JobRunData,
    | "id"
    | "job_id"
    | "queue"
    | "name"
    | "status"
    | "attempt"
    | "max_attempts"
    | "created_at"
    | "enqueued_at"
    | "started_at"
    | "finished_at"
    | "error_message"
    | "tags"
    | "updated_at"
  >[];
  const processedData = data.map((item) => ({
    ...item,
    created_at: new Date(`${item.created_at}Z`).getTime(),
    enqueued_at: item.enqueued_at
      ? new Date(`${item.enqueued_at}Z`).getTime()
      : null,
    started_at: item.started_at
      ? new Date(`${item.started_at}Z`).getTime()
      : null,
    finished_at: item.finished_at
      ? new Date(`${item.finished_at}Z`).getTime()
      : null,
    updated_at: new Date(`${item.updated_at}Z`).getTime(),
  }));

  return processedData;
};

export const cancelJobRun = async (job: Omit<JobRunData, "updated_at">) => {
  await clickhouseClient.insert({
    table: "job_runs_ch",
    values: [
      {
        ...job,
        created_at: job.created_at.getTime(),
        enqueued_at: job.enqueued_at?.getTime(),
        started_at: job.started_at?.getTime(),
        finished_at: job.finished_at?.getTime(),
      },
    ],
    format: "JSONEachRow",
  });
};
