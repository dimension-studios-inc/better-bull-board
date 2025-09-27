import { patch } from "@better-bull-board/client";
import type { SandboxedJob } from "bullmq";
import { redis } from "../lib/redis";

export default patch(async (job: SandboxedJob) => {
  console.log(`Processing job ${job.id}`);

  await new Promise((resolve) => setTimeout(resolve, 10_000));

  console.log(`Job ${job.id} processed`);

  return { status: "done" };
}, redis);
