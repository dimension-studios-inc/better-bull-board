-- migrate data
INSERT INTO job_logs_ch_v2 SELECT id, job_run_id, level, message, ts, 0 FROM job_logs_ch;
