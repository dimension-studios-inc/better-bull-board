import { clickhouseClient } from "../lib/client";
import { type JobLogData, jobLogDataSchema } from "./schemas";

export const insertJobLog = async (_jobLog: JobLogData): Promise<void> => {
  const jobLog = jobLogDataSchema.parse(_jobLog);
  await clickhouseClient.insert({
    table: "job_logs_ch",
    values: [
      {
        ...jobLog,
        ts: jobLog.ts.getTime(),
      },
    ],
    format: "JSONEachRow",
  });
};

export const searchJobLogs = async (filters: {
  jobRunId?: string;
  id?: string;
  level?: string;
  messageContains?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}): Promise<(Omit<JobLogData, "ts"> & { ts: number })[]> => {
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.jobRunId) {
    conditions.push("job_run_id = {job_run_id:UUID}");
    params.job_run_id = filters.jobRunId;
  }

  if (filters.id) {
    conditions.push("job_run_id = {id:UUID}");
    params.id = filters.id;
  }

  if (filters.level) {
    conditions.push("level = {level:String}");
    params.level = filters.level;
  }

  if (filters.messageContains) {
    conditions.push("position(message, {message_contains:String}) > 0");
    params.message_contains = filters.messageContains;
  }

  if (filters.dateFrom) {
    conditions.push("ts >= {date_from:DateTime64(3, 'UTC')}");
    params.date_from = filters.dateFrom;
  }

  if (filters.dateTo) {
    conditions.push("ts <= {date_to:DateTime64(3, 'UTC')}");
    params.date_to = filters.dateTo;
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;

  const query = `
    SELECT * FROM job_logs_ch 
    ${whereClause}
    ORDER BY ts DESC, log_seq ASC
    LIMIT {limit:UInt32} OFFSET {offset:UInt32}
  `;

  const result = await clickhouseClient.query({
    query,
    query_params: { ...params, limit, offset },
    format: "JSONEachRow",
  });

  const data = (await result.json()) as JobLogData[];
  return data.map((item) => ({
    ...item,
    ts: new Date(`${item.ts}Z`).getTime(),
  }));
};
