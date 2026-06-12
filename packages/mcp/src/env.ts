import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BBB_MCP_HOST: z.string().default("127.0.0.1"),
    BBB_MCP_PORT: z
      .string()
      .default("3333")
      .transform((value) => Number.parseInt(value, 10))
      .pipe(z.number().int().min(1).max(65535)),
    BBB_MCP_TOKEN: z.string().min(32, "BBB_MCP_TOKEN must be at least 32 characters"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
