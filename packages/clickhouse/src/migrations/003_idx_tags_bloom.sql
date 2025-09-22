
ALTER TABLE job_runs_ch
  ADD INDEX idx_tags_bloom (tags) TYPE bloom_filter(0.01) GRANULARITY 64;
