ALTER TABLE job_runs_ch
  ADD INDEX idx_status (status) TYPE set(0) GRANULARITY 64;

