CREATE TABLE IF NOT EXISTS migrations_ch
(
  -- identifiers
  id UUID,                                -- same UUID as Postgres
  name String,
  applied_at DateTime64(3, 'UTC'),

)
ENGINE = MergeTree
PARTITION BY toYYYYMM(applied_at)
ORDER BY (name, applied_at, id)
SETTINGS index_granularity = 8192;
