import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "@better-bull-board/client";
import { redis } from "./lib/redis";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const processorFile = path.join(__dirname, "processor.cjs");
new Worker("demo-queue", processorFile, {
  connection: redis,
  ioredis: redis,
  useWorkerThreads: true,
  concurrency: 10,
});
