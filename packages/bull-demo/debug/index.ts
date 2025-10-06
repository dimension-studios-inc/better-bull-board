import { logger } from "@rharkor/logger";
import { Queue } from "bullmq";
import { redis } from "../src/lib/redis";
import { deleteAllSchedulers } from "../src/utils";

const main = async () => {
  await logger.init();
  await deleteAllSchedulers();
  // await registerScheduler();
  // logger.log("Scheduler registered");

  const singleJob = async () => {
    const randomQueue = `{demo-queue}`;
    const queue = new Queue(randomQueue, {
      connection: redis,
    });
    const job = await queue.add("test-job-name", {
      wait: 1000,
    });
    if (!job.id) throw new Error("Job ID is undefined");
  };
  const bulkJobs = async (count: number) => {
    await Promise.all(Array.from({ length: count }).map(() => singleJob()));
  };

  setInterval(async () => {
    await bulkJobs(10);
  }, 15000);
  await bulkJobs(10);
};

main();
