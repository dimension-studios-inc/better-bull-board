import type { Queue } from "bullmq";
import { queue as queue1 } from "./demo1/queue";
import { queue as queue2, queue3, queue4, queue5 } from "./demo2/queue";

export const deleteAllSchedulers = async () => {
  const cleanQueueSchedulers = async (queue: Queue) => {
    const schedulers = await queue.getJobSchedulers();
    await Promise.all(
      schedulers.map((scheduler) => queue.removeJobScheduler(scheduler.key)),
    );
  };

  await cleanQueueSchedulers(queue1);
  await cleanQueueSchedulers(queue2);
  await cleanQueueSchedulers(queue3);
  await cleanQueueSchedulers(queue4);
  await cleanQueueSchedulers(queue5);
};

export const registerScheduler = async () => {
  await queue1.upsertJobScheduler("demo-queue", {
    pattern: "* * * * *",
  });
  await queue2.upsertJobScheduler("demo-queue-2", {
    every: 20_000,
  });
};
