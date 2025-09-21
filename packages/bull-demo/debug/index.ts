import { logger } from "@rharkor/logger";
import { registerScheduler } from "../src/queue";

const main = async () => {
  await logger.init();
  await registerScheduler();
  logger.log("Scheduler registered");
};

main().then(() => process.exit(0));
