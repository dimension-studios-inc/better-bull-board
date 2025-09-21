import { Worker } from "@better-bull-board/client";
import { redis } from "./lib/redis";

new Worker(
  "demo-queue",
  async (job) => {
    job.log(`Processing job ${job.id} with data`);
    console.log(job.id);
    return { status: "done" };
  },
  {
    connection: redis,
    publish: redis.publish.bind(redis),
  },
);
