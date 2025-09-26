import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "@better-bull-board/client";
import { redis } from "./lib/redis";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const processorFile1 = path.join(__dirname, "demo1/processor.cjs");
const processorFile2 = path.join(__dirname, "demo2/processor.cjs");
new Worker("demo-queue", processorFile1, {
  connection: redis,
  ioredis: redis,
  useWorkerThreads: true,
  concurrency: 10,
  getJobTags() {
    return ["demo-queue", "test"];
  },
});

new Worker("demo-queue-2", processorFile2, {
  connection: redis,
  ioredis: redis,
  useWorkerThreads: true,
  concurrency: 10,
  getJobTags() {
    return ["demo-queue-2"];
  },
});
