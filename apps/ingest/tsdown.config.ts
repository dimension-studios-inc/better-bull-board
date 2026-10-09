import { defineConfig } from "tsdown"

export default defineConfig({
  entry: ["./src/**/*.ts", "!./src/**/*.d.ts", "!./src/**/*.test.ts"],
  format: ["esm"],
  dts: true,
  minify: true,
})
