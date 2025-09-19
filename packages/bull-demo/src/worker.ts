import { Worker } from "bullmq";
import { redis } from "./lib/redis";
import { queue } from "./queue";

queue.upsertJobScheduler("demo-queue", {
	every: 5000,
});

const worker = new Worker(
	"demo-queue",
	async (job) => {
		console.log(`Processing job ${job.id} with data:`, job.data);
	},
	{
		connection: redis,
	},
);

worker.on("completed", (job) => {
	console.log(`✅ Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
	console.error(`❌ Job ${job?.id} failed:`, err);
});
