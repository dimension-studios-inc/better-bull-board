import { logger } from "@rharkor/logger";

const main = async () => {
  await logger.init();
};

main().then(() => process.exit(0));
