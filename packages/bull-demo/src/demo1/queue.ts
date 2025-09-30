import { Queue, type QueueOptions } from "bullmq";
import { redis } from "../lib/redis";

const defaultJobOptions: QueueOptions["defaultJobOptions"] = {
  removeOnComplete: {
    age: 60 * 60 * 24 * 3, // keep up to 3 days
    count: 1000, // keep up to 1000 jobs
  },
  removeOnFail: {
    age: 60 * 60 * 24 * 7, // keep up to 7 days
  },
} as const;

export const queue = new Queue("demo-queue", {
  connection: redis,
  defaultJobOptions,
});
