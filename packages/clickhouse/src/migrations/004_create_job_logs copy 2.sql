CREATE TABLE job_logs_ch
(
  id UUID,
  job_run_id UUID,
  level LowCardinality(String),
  message String CODEC(ZSTD(3)),
  ts DateTime64(3, 'UTC')
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(ts)
ORDER BY (job_run_id, ts, id)
TTL ts + INTERVAL 15 DAY DELETE
SETTINGS index_granularity = 8192;
