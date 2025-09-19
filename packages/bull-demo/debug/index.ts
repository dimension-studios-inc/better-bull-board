import { logger } from "@rharkor/logger";
import { queue } from "../src/queue";

const main = async () => {
  await logger.init();

  // Add a job that runs every 5 seconds
  await queue.add(
    "print",
    { message: "Hello from BullMQ!" },
    {
      repeat: {
        every: 5000, // repeat every 5s
      },
    },
  );

  console.log("Job scheduled every 5s. Press Ctrl+C to stop.");
};

main().then(() => process.exit(0));
