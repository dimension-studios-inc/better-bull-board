import { logger } from "@rharkor/logger";

const main = async () => {
  await logger.init();
  logger.debug("Hello, world!");
};

main().then(() => process.exit(0));
