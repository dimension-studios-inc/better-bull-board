import { Queue } from "bullmq";
import { redis } from "../lib/redis";

export const queue = new Queue("demo-queue-2", {
  connection: redis,
});

export const registerScheduler = async () => {
  await queue.upsertJobScheduler("demo-queue-2", {
    every: 20_000,
  });
};
