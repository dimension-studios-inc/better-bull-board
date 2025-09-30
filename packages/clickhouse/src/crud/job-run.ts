import z from "zod";
import { omit } from "~/utils";
import { clickhouseClient } from "../lib/client";
import { type JobRunData, jobRunDataSchema } from "./schemas";

const jobRunsUpdateTypes: Record<string, string> = {
  // identifiers
  job_id: "String",
  queue: "String", // LowCardinality(String) → String
  name: "Nullable(String)",

  // status / attempts
  status: "String", // LowCardinality(String) → String
  attempt: "UInt16",
  max_attempts: "UInt16",
  priority: "Nullable(Int32)",
  delay_ms: "UInt32",
  backoff: "Nullable(JSON)",

  // relationships
  repeat_job_key: "Nullable(String)",
  parent_job_id: "Nullable(String)",
  worker_id: "Nullable(String)",

  // arrays / tags
  tags: "Array(String)", // LowCardinality(String) in array → Array(String)

  // payloads
  data: "Nullable(JSON)",
  result: "Nullable(JSON)",

  // errors
  error_type: "Nullable(String)",
  error_message: "Nullable(String)",
  error_stack: "Nullable(String)",

  // timing
  enqueued_at: "Nullable(DateTime64(3, 'UTC'))",
  started_at: "Nullable(DateTime64(3, 'UTC'))",
  finished_at: "Nullable(DateTime64(3, 'UTC'))",
};

export const upsertJobRun = async (
  _jobRun: JobRunData,
  kind: "insert" | "update",
): Promise<void> => {
  const jobRun = jobRunDataSchema.parse(_jobRun);
  const formattedRun = {
    ...jobRun,
    created_at: jobRun.created_at.getTime(),
    enqueued_at: jobRun.enqueued_at?.getTime(),
    started_at: jobRun.started_at?.getTime(),
    finished_at: jobRun.finished_at?.getTime(),
  };
  if (kind === "update") {
    const updateData = {
      ...omit(formattedRun, ["created_at", "job_id", "id", "queue"]),
      backoff: formattedRun.backoff
        ? JSON.stringify(formattedRun.backoff)
        : null,
      data: formattedRun.data ? JSON.stringify(formattedRun.data) : null,
      result: formattedRun.result ? JSON.stringify(formattedRun.result) : null,
    };
    await clickhouseClient.command({
      query: `UPDATE job_runs_ch SET ${Object.entries(updateData)
        .map(([key]) => `${key} = {${key}:${jobRunsUpdateTypes[key]}}`)
        .join(", ")} WHERE id = {id:UUID}`,
      query_params: { id: formattedRun.id, ...updateData },
    });
  } else {
    await clickhouseClient.insert({
      table: "job_runs_ch",
      values: [formattedRun],
      format: "JSONEachRow",
    });
  }
};

export const bulkUpsertJobRun = async (
  _jobRuns: { data: JobRunData; kind: "insert" | "update" }[],
): Promise<void> => {
  const toInsert = _jobRuns.filter((jobRun) => jobRun.kind === "insert");
  const toUpdate = _jobRuns.filter((jobRun) => jobRun.kind === "update");

  const jobRunsToInsert = jobRunDataSchema
    .array()
    .parse(toInsert.map((jobRun) => jobRun.data));
  const formattedRunsToInsert = jobRunsToInsert.map((jobRun) => ({
    ...jobRun,
    created_at: jobRun.created_at.getTime(),
    enqueued_at: jobRun.enqueued_at?.getTime(),
    started_at: jobRun.started_at?.getTime(),
    finished_at: jobRun.finished_at?.getTime(),
  }));

  const jobRunsToUpdate = jobRunDataSchema
    .array()
    .parse(toUpdate.map((jobRun) => jobRun.data));
  const formattedRunsToUpdate = jobRunsToUpdate.map((jobRun) => ({
    ...jobRun,
    created_at: jobRun.created_at.getTime(),
    enqueued_at: jobRun.enqueued_at?.getTime(),
    started_at: jobRun.started_at?.getTime(),
    finished_at: jobRun.finished_at?.getTime(),
  }));

  await clickhouseClient.insert({
    table: "job_runs_ch",
    values: formattedRunsToInsert,
    format: "JSONEachRow",
  });

  const updateRow = async (jobRun: (typeof formattedRunsToUpdate)[number]) => {
    const updateData = {
      ...omit(jobRun, ["created_at", "job_id", "id", "queue"]),
      backoff: jobRun.backoff ? JSON.stringify(jobRun.backoff) : null,
      data: jobRun.data ? JSON.stringify(jobRun.data) : null,
      result: jobRun.result ? JSON.stringify(jobRun.result) : null,
    };
    await clickhouseClient.command({
      query: `UPDATE job_runs_ch SET ${Object.entries(updateData)
        .map(([key]) => `${key} = {${key}:${jobRunsUpdateTypes[key]}}`)
        .join(", ")} WHERE id = {id:UUID}`,
      query_params: { id: jobRun.id, ...updateData },
    });
  };

  // Can't bulk update in ClickHouse, so we need to update each one individually
  await Promise.all(formattedRunsToUpdate.map(updateRow));
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
  (Omit<
    JobRunData,
    "created_at" | "enqueued_at" | "started_at" | "finished_at"
  > & {
    created_at: number;
    enqueued_at: number | null;
    started_at: number | null;
    finished_at: number | null;
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
    // cursor should be an object with created_at, job_id, id
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
  SELECT *
  FROM job_runs_ch
  ${whereClause}
  ORDER BY created_at ${orderDirection}, job_id ${orderDirection}, id ${orderDirection}
  LIMIT {limit:UInt32}
`;

  const result = await clickhouseClient.query({
    query,
    query_params: { ...params, limit },
    format: "JSONEachRow",
  });

  const data = (await result.json()) as JobRunData[];
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
  }));

  return processedData;
};

export const cancelJobRun = async (jobId: string) => {
  await clickhouseClient.command({
    query: `UPDATE job_runs_ch SET status = 'failed', error_message = 'Job cancelled' WHERE job_id = {job_id:String}`,
    query_params: { job_id: jobId },
  });
};
