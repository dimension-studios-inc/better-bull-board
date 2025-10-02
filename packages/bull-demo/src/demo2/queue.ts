import { Queue } from "bullmq";
import { redis } from "../lib/redis";

export const queue = new Queue("{demo-queue-2}", {
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

export const queue3 = new Queue("demo-queue-3", {
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

export const queue4 = new Queue("demo-queue-4", {
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

export const queue5 = new Queue("demo-queue-5", {
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
