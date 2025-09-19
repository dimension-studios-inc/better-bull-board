import { Queue } from "bullmq";
import { redis } from "./lib/redis";

export const queue = new Queue("demo-queue", {
	connection: redis,
});
