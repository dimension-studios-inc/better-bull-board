import { logger } from "@rharkor/logger";
import { queue } from "../src/demo2/queue";
import { deleteAllSchedulers } from "../src/utils";

const main = async () => {
  await logger.init();
  await deleteAllSchedulers();
  // await registerScheduler();
  // logger.log("Scheduler registered");

  const singleJob = async () => {
    const job = await queue.add("test-job-name", {
      wait: 500,
      longData: new Array(1000).fill("test"),
    });
    if (!job.id) throw new Error("Job ID is undefined");
  };

  // await queue.add("test-job-name", {
  //   hello: "world",
  // });

  const bulkJobs = async (count: number) => {
    await Promise.all(Array.from({ length: count }).map(() => singleJob()));
  };

  setInterval(async () => {
    await bulkJobs(10);
  }, 1000);
};

main();
