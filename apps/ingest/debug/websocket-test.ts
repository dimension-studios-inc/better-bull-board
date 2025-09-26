import { logger } from "@rharkor/logger";
import { redis } from "../src/lib/redis";

/**
 * Test script to simulate Redis events that should trigger WebSocket messages
 * This can be used to verify the complete flow from Redis to frontend updates
 */

const testRedisEvents = async () => {
  await logger.init();
  logger.log("🧪 Starting WebSocket test - simulating Redis events");

  // Simulate job refresh event (from job processing)
  await redis.publish("bbb:ingest:events:job-refresh", "test-job-123");
  logger.log("📤 Published job-refresh event for job: test-job-123");

  // Simulate queue refresh event (from queue update)
  await redis.publish("bbb:ingest:events:queue-refresh", "test-queue");
  logger.log("📤 Published queue-refresh event for queue: test-queue");

  // Simulate job scheduler refresh event (from scheduler update)
  await redis.publish("bbb:ingest:events:job-scheduler-refresh", "test-scheduler-key");
  logger.log("📤 Published job-scheduler-refresh event for scheduler: test-scheduler-key");

  // Simulate log refresh event (from log processing)
  await redis.publish("bbb:ingest:events:log-refresh", "test-job-456");
  logger.log("📤 Published log-refresh event for job: test-job-456");

  logger.log("✅ All test events published. Check WebSocket clients for received messages.");
  
  // Wait a bit then exit
  setTimeout(() => {
    logger.log("🔚 Test completed");
    process.exit(0);
  }, 2000);
};

testRedisEvents().catch(console.error);