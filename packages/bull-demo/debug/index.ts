import { logger } from "@rharkor/logger";
import { queue, registerScheduler } from "../src/queue";

const main = async () => {
  await logger.init();
  await registerScheduler();
  logger.log("Scheduler registered");
  queue.add("test-job-name", {});
};

main().then(() => process.exit(0));
