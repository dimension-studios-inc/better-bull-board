import type { Queue } from "bullmq";
import { queue } from "./demo/queue";

export const deleteAllSchedulers = async () => {
  const cleanQueueSchedulers = async (queue: Queue) => {
    const schedulers = await queue.getJobSchedulers();
    await Promise.all(
      schedulers.map((scheduler) => queue.removeJobScheduler(scheduler.key)),
    );
  };

  await cleanQueueSchedulers(queue);
};

export const registerScheduler = async () => {
  await queue.upsertJobScheduler("demo-queue", {
    every: 20_000,
  });
};
