import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    ADMIN_EMAIL: z.string().email(),
    ADMIN_PASSWORD: z.string().min(1),
    JWT_SECRET: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.url(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
});
