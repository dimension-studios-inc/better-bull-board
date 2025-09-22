ALTER TABLE job_logs_ch
  ADD INDEX idx_message_ngram (message)
  TYPE ngrambf_v1(3, 512, 2, 0) GRANULARITY 1;
