import { logger } from "@rharkor/logger";
import { queue } from "../src/demo2/queue";
import { deleteAllSchedulers } from "../src/utils";

const main = async () => {
  await logger.init();
  await deleteAllSchedulers();
  // await registerScheduler();
  // logger.log("Scheduler registered");

  // const singleJob = async (i: number) => {
  //   const job = await queue.add("test-job-name", {});
  //   if (!job.id) throw new Error("Job ID is undefined");
  //   const shouldCancel = i % 2 === 0;
  //   if (shouldCancel) {
  //     await cancelJob({ redis, jobId: job.id, queueName: "demo-queue" });
  //   }
  // };

  await queue.add("test-job-name", {
    hello: "world",
  });

  // const bulkJobs = async () => {
  //   await Promise.all(Array.from({ length: 1000 }).map((_, i) => singleJob(i)));
  // };

  // await bulkJobs();
};

main().then(() => process.exit(0));
