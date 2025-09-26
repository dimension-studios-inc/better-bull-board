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

export const upsertJobRun = async (_jobRun: JobRunData): Promise<void> => {
  const jobRun = jobRunDataSchema.parse(_jobRun);
  const existingJobRun = await searchJobRuns({
    id: jobRun.id,
  });
  const formattedRun = {
    ...jobRun,
    created_at: jobRun.created_at.getTime(),
    enqueued_at: jobRun.enqueued_at?.getTime(),
    started_at: jobRun.started_at?.getTime(),
    finished_at: jobRun.finished_at?.getTime(),
  };
  if (existingJobRun.length > 0) {
    const updateData = {
      ...omit(formattedRun, ["created_at", "job_id", "id", "queue"]),
      backoff: formattedRun.backoff
        ? JSON.stringify(formattedRun.backoff)
        : null,
      data: formattedRun.data ? JSON.stringify(formattedRun.data) : null,
      result: formattedRun.result ? JSON.stringify(formattedRun.result) : null,
    };
    await clickhouseClient.command({
      query: `ALTER TABLE job_runs_ch UPDATE ${Object.entries(updateData)
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

export const searchJobRuns = async (filters: {
  id?: string;
  jobId?: string;
  queue?: string;
  status?: string;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
  search?: string;
  cursor?: string;
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
    conditions.push("id > {cursor:String}");
    params.cursor = filters.cursor;
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;

  const query = `
    SELECT  
      toUnixTimestamp(created_at) * 1000 AS created_at,
      toUnixTimestamp(enqueued_at) * 1000 AS enqueued_at,
      toUnixTimestamp(started_at) * 1000 AS started_at,
      toUnixTimestamp(finished_at) * 1000 AS finished_at,
      *
    FROM job_runs_ch 
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT {limit:UInt32} OFFSET {offset:UInt32}
  `;

  const result = await clickhouseClient.query({
    query,
    query_params: { ...params, limit, offset },
    format: "JSONEachRow",
  });

  const data = (await result.json()) as JobRunData[];
  return data.map((item) => ({
    ...item,
    created_at: Number(item.created_at),
    enqueued_at: item.enqueued_at ? Number(item.enqueued_at) : null,
    started_at: item.started_at ? Number(item.started_at) : null,
    finished_at: item.finished_at ? Number(item.finished_at) : null,
  }));
};

export const cancelJobRun = async (jobId: string) => {
  await clickhouseClient.command({
    query: `ALTER TABLE job_runs_ch UPDATE status = 'failed', error_message = 'Job cancelled' WHERE job_id = {job_id:String}`,
    query_params: { job_id: jobId },
  });
};
