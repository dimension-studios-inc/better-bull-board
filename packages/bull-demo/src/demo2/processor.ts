import { patch } from "@better-bull-board/client";
import type { SandboxedJob } from "bullmq";
import { redis } from "../lib/redis";

export default patch(async (job: SandboxedJob) => {
  console.log(`Processing job ${job.id}`);

  // Print random log level 2k times
  for (let i = 0; i < 20; i++) {
    const levels = ["debug", "info", "warn", "error", "log"] as const;
    const loremSamples = [
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit sed.",
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad.",
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit.",
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius turpis et commodo pharetra est eros.",
    ] as const;

    // biome-ignore lint/style/noNonNullAssertion: _
    const level = levels[Math.floor(Math.random() * levels.length)]!;
    const lorem = loremSamples[Math.floor(Math.random() * loremSamples.length)];

    console[level](`[${i}] ${lorem}`);
  }

  console.log(`Job ${job.id} processed`);

  return {
    status: {
      name: "done",
      description: "Job completed successfully",
    },
  };
}, redis);
