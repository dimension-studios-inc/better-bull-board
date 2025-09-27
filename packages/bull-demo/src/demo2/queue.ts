import { Queue } from "bullmq";
import { redis } from "../lib/redis";

export const queue = new Queue("demo-queue-2", {
  connection: redis,
});

export const queue3 = new Queue("demo-queue-3", {
  connection: redis,
});

export const queue4 = new Queue("demo-queue-4", {
  connection: redis,
});

export const queue5 = new Queue("demo-queue-5", {
  connection: redis,
});
