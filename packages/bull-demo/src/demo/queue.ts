import { Queue } from "bullmq";
import { redis } from "../lib/redis";

export const queue = new Queue("{demo-queue}", {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: {
      age: 60 * 60 * 24 * 3, // keep up to 3 days
      count: 1000, // keep up to 1000 jobs
    },
    removeOnFail: {
      age: 60 * 60 * 24 * 7, // keep up to 7 days
    },
  },
});
