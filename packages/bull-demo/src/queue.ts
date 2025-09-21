import { Queue } from "@better-bull-board/client";
import { redis } from "./lib/redis";

export const queue = new Queue("demo-queue", {
  connection: redis,
});

export const registerScheduler = async () => {
  queue.upsertJobScheduler("demo-queue", {
    every: 5000,
  });
};
