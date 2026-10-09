import type { Queue } from "bullmq"

import { queue } from "./demo/queue"

export const deleteAllSchedulers = async () => {
  const cleanQueueSchedulers = async (targetQueue: Queue) => {
    const schedulers = await targetQueue.getJobSchedulers()
    await Promise.all(schedulers.map((scheduler) => targetQueue.removeJobScheduler(scheduler.key)))
  }

  await cleanQueueSchedulers(queue)
}

export const registerScheduler = async () => {
  await queue.upsertJobScheduler("demo-queue", {
    every: 20_000,
  })
}
