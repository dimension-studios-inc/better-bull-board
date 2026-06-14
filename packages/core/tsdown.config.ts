import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/jobs.ts", "./src/mutations.ts", "./src/overview.ts", "./src/queues.ts"],
  format: ["esm"],
  dts: true,
  minify: true,
});
