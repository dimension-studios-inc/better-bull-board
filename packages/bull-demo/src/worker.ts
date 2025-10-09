import path from "node:path";
import { EventEmitter } from "node:stream";
import { fileURLToPath } from "node:url";
import { Worker } from "@better-bull-board/client";
import { logger } from "@rharkor/logger";
import { redis } from "./lib/redis";

EventEmitter.setMaxListeners(0);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const getProcessorFile = () => path.join(__dirname, `demo/processor.cjs`);

const main = async () => {
  await logger.init();
  const worker = new Worker(`{demo-queue}`, getProcessorFile(), {
    connection: redis,
    ioredis: redis,
    useWorkerThreads: true,
    concurrency: 1,
    getJobTags() {
      return [`demo-queue`];
    },
  });
  await worker.waitingJobsEvent();

  logger.info("Worker started");
};

main();
