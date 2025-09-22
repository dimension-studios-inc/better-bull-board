import { Worker } from "@better-bull-board/client";
import { redis } from "./lib/redis";

new Worker(
  "demo-queue",
  async (job) => {
    console.log(`Processing job ${job.id}`);

    return { status: "done" };
  },
  {
    connection: redis,
    publish: redis.publish.bind(redis),
    getJobTags(_job) {
      // Random number between 0 and 3
      const random = Math.floor(Math.random() * 4);
      return Array.from({ length: random }, () => {
        // Return a random words in the array
        const words = ["tag1", "tag2", "tag3", "tag4"];
        return words[Math.floor(Math.random() * words.length)];
      });
    },
  },
);
