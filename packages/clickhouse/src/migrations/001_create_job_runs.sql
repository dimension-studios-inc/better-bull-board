CREATE TABLE job_runs_ch
(
  -- identifiers
  id UUID,                                -- same UUID as Postgres
  job_id String,
  queue LowCardinality(String),
  name Nullable(String),

  -- status / attempts
  status LowCardinality(String),
  attempt UInt16,
  max_attempts UInt16,
  priority Nullable(Int32),
  delay_ms UInt32,
  backoff JSON,                           -- JSON blob { type, delay, strategy }

  -- relationships
  repeat_job_key Nullable(String),
  parent_job_id Nullable(String),
  worker_id Nullable(String),

  -- arrays / tags
  tags Array(LowCardinality(String)),

  -- payloads
  data JSON,
  result JSON,

  -- errors
  error_type Nullable(String),
  error_message Nullable(String) CODEC(ZSTD(3)),
  error_stack Nullable(String) CODEC(ZSTD(3)),

  -- timing
  created_at DateTime64(3, 'UTC'),
  enqueued_at Nullable(DateTime64(3, 'UTC')),
  started_at Nullable(DateTime64(3, 'UTC')),
  finished_at Nullable(DateTime64(3, 'UTC')),

  duration_ms Nullable(UInt32) MATERIALIZED
    (finished_at IS NULL OR started_at IS NULL
      ? NULL
      : toUInt32(1000 * date_diff('millisecond', started_at, finished_at)))
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(created_at)
ORDER BY (created_at, queue, job_id, id)
TTL created_at + INTERVAL 30 DAY DELETE
SETTINGS index_granularity = 8192;
