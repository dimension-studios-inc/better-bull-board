import { defineConfig } from "tsdown"

export default defineConfig({
  entry: ["./src/**/*.ts", "!./src/**/*.d.ts", "!./src/**/*.test.ts"],
  format: ["esm", "cjs"],
  dts: true,
  minify: true,
})
