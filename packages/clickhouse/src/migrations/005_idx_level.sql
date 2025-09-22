ALTER TABLE job_logs_ch
  ADD INDEX idx_level (level) TYPE set(0) GRANULARITY 64;