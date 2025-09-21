import { Worker } from "bullmq";
import { redis } from "./lib/redis";

new Worker(
  "demo-queue",
  async (job) => {
    job.log(`Processing job ${job.id} with data`);
    console.log(job.id);
  },
  {
    connection: redis,
  },
);
