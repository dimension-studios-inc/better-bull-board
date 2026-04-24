DELETE FROM "job_logs"
WHERE "id" IN (
  SELECT "id"
  FROM (
    SELECT
      "id",
      row_number() OVER (
        PARTITION BY "job_run_id", "ts", "log_seq"
        ORDER BY "id"
      ) AS duplicate_number
    FROM "job_logs"
  ) duplicates
  WHERE duplicates.duplicate_number > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX "ux_job_logs_run_ts_seq" ON "job_logs" USING btree ("job_run_id","ts","log_seq");
