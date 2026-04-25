import { patch } from "@better-bull-board/client";
import type { SandboxedJob } from "bullmq";
import { redis } from "../lib/redis";

export default patch(async (job: SandboxedJob) => {
  console.log(`Processing job ${job.id}`);

  await new Promise((resolve) => setTimeout(resolve, job.data.wait));

  if (job.data.shouldFail) {
    console.error(`Job ${job.id} failed intentionally`);
    throw new Error(`Stress test intentional failure for job ${job.id}`);
  }

  console.log(`Job ${job.id} processed`);

  return {
    status: {
      name: "done",
      description: "Job completed successfully",
    },
  };
}, redis);
