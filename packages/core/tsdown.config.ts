import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "./src/job-schemas.ts",
    "./src/mutation-schemas.ts",
    "./src/jobs.ts",
    "./src/mutations.ts",
    "./src/overview.ts",
    "./src/queues.ts",
  ],
  format: ["esm"],
  dts: true,
  minify: true,
});
