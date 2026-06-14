import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts", "./src/server.ts", "./src/scopes.ts"],
  format: ["esm"],
  dts: true,
  minify: true,
});
