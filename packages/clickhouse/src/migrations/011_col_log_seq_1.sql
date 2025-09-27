CREATE TABLE job_logs_ch_v2
(
  id UUID,
  job_run_id UUID,
  level LowCardinality(String),
  message String CODEC(ZSTD(3)),
  ts DateTime64(3, 'UTC'),
  log_seq UInt16 DEFAULT 0
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(ts)
ORDER BY (job_run_id, ts, log_seq, id)
TTL ts + INTERVAL 30 DAY DELETE
SETTINGS index_granularity = 8192;