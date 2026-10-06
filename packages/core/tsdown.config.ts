import { defineConfig } from "tsdown"

export default defineConfig({
  entry: [
    "./src/errors.ts",
    "./src/job-schemas.ts",
    "./src/list-jobs-limit.ts",
    "./src/mutation-schemas.ts",
    "./src/queue-schemas.ts",
    "./src/scheduler-schemas.ts",
    "./src/top-errors-schemas.ts",
    "./src/jobs.ts",
    "./src/mutations.ts",
    "./src/overview.ts",
    "./src/queues.ts",
    "./src/schedulers.ts",
    "./src/stuck-run-schemas.ts",
    "./src/stuck-runs.ts",
    "./src/top-errors.ts",
  ],
  format: ["esm"],
  dts: true,
  minify: true,
})
