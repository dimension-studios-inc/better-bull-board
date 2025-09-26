import { logger } from "@rharkor/logger";
import { db } from "../src/server";
import { invitationTable } from "../src";

const main = async () => {
  await logger.init();
};

main().then(() => process.exit(0));
