import { patch } from "@better-bull-board/client";
import type { SandboxedJob } from "bullmq";
import { redis } from "../lib/redis";

export default patch(async (job: SandboxedJob) => {
  console.log(`Processing job ${job.id}`);

  // Print random log level 2k times
  for (let i = 0; i < 20; i++) {
    const levels = ["debug", "info", "warn", "error", "log"] as const;
    // biome-ignore lint/style/noNonNullAssertion: _
    const level = levels[Math.floor(Math.random() * levels.length)]!;
    console[level](`Emitting log ${i}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log(`Job ${job.id} processed`);

  return {
    status: {
      name: "done",
      description: "Job completed successfully",
    },
  };
}, redis);
