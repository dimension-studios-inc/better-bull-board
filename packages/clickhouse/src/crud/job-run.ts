import z from "zod";
import { omit } from "~/utils";
import { clickhouseClient } from "../lib/client";
import { type JobRunData, jobRunDataSchema } from "./schemas";

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
        .map(
          ([key, value]) =>
            `${key} = {${key}:${getClickHouseType(value as unknown)}}`,
        )
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
}): Promise<JobRunData[]> => {
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
    SELECT * FROM job_runs_ch 
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT {limit:UInt32} OFFSET {offset:UInt32}
  `;

  const result = await clickhouseClient.query({
    query,
    query_params: { ...params, limit, offset },
    format: "JSONEachRow",
  });

  return await result.json();
};

// Helper function to determine ClickHouse type from value
function getClickHouseType(value: unknown): string {
  if (value === null || value === undefined) return "Nullable(String)";
  if (typeof value === "string") return "String";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return "Int32";
    return "Float64";
  }
  if (typeof value === "boolean") return "UInt8";
  if (value instanceof Date) return "DateTime64(3, 'UTC')";
  if (Array.isArray(value)) return "Array(String)";
  if (typeof value === "object") return "JSON";
  return "String";
}
