import z from "zod";

export const jobLogDataSchema = z.object({
  id: z.string(),
  job_run_id: z.string(),
  level: z.string(),
  message: z.string(),
  ts: z.coerce.date(),
  log_seq: z.number(),
});

export type JobLogData = z.infer<typeof jobLogDataSchema>;

export const jobRunDataSchema = z.object({
  id: z.string(),
  job_id: z.string(),
  queue: z.string(),
  name: z.string().nullable(),
  status: z.string(),
  attempt: z.number(),
  max_attempts: z.number(),
  priority: z.number().nullable(),
  delay_ms: z.number(),
  backoff: z.unknown().nullable(),
  repeat_job_key: z.string().nullable(),
  parent_job_id: z.string().nullable(),
  worker_id: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  data: z.unknown().nullable(),
  result: z.unknown().nullable(),
  error_message: z.string().nullable(),
  error_stack: z.string().nullable(),
  created_at: z.coerce.date(),
  enqueued_at: z.coerce.date().nullable(),
  started_at: z.coerce.date().nullable(),
  finished_at: z.coerce.date().nullable(),
});

export type JobRunData = z.infer<typeof jobRunDataSchema>;

export interface JobStats {
  active: number;
  failed: number;
  completed: number;
}

export interface QueueChartData {
  timestamp: string;
  completed: number;
  failed: number;
}

export interface QueueStatsWithChart {
  queueName: string;
  activeJobs: number;
  failedJobs: number;
  completedJobs: number;
  chartData: QueueChartData[];
}

export interface EnhancedJobStats {
  runningTasks: number;
  waitingInQueue: number;
  successes: number;
  failures: number;
}

export interface QueuePerformanceData {
  queue: string;
  totalRuns: number;
  successes: number;
  failures: number;
  errorRate: number;
  avgDuration: number;
}

export interface QueueDurationData {
  queue: string;
  totalDuration: number;
}

export interface QueueCountData {
  queue: string;
  runCount: number;
}

export interface RunGraphData {
  timestamp: string;
  runCount: number;
}
