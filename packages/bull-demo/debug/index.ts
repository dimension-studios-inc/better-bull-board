import { cancelJob } from "@better-bull-board/client/lib/cancellation";
import { logger } from "@rharkor/logger";
import { queue } from "../src/demo2/queue";
import { redis } from "../src/lib/redis";
import { deleteAllSchedulers } from "../src/utils";

const main = async () => {
  await logger.init();
  await deleteAllSchedulers();
  // await registerScheduler();
  // logger.log("Scheduler registered");

  const singleJob = async (i: number) => {
    const job = await queue.add("test-job-name", {});
    if (!job.id) throw new Error("Job ID is undefined");
    const shouldCancel = i % 2 === 0;
    if (shouldCancel) {
      await cancelJob({ redis, jobId: job.id, queueName: "demo-queue" });
    }
  };

  // await queue.add("test-job-name", {
  //   hello: "world",
  // });

  const bulkJobs = async (count: number) => {
    await Promise.all(
      Array.from({ length: count }).map((_, i) => singleJob(i)),
    );
  };

  setInterval(() => bulkJobs(1000), 1000);
};

main();
