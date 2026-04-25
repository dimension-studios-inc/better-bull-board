import { logger } from "@rharkor/logger";
import { formatJobRun, type JobRunInsert, type JobSnapshot } from "~/sync/job-format";
import { safeUpsertJobRuns } from "~/sync/job-upsert";

// Batching configuration
const FLUSH_SIZE = 300;
const FLUSH_INTERVAL = 200; // ms

// Buffers for batching
const jobRunBuffer: Array<{
  data: JobRunInsert;
  dbId?: string;
}> = [];

let flushTimer: NodeJS.Timeout | null = null;

// Batch flush function for PostgreSQL
// Batch flush function for PostgreSQL
async function flushJobRunBuffer() {
  if (jobRunBuffer.length === 0) return;

  // Take everything currently in the buffer
  const batch = jobRunBuffer.splice(0, jobRunBuffer.length);

  try {
    await safeUpsertJobRuns(batch.map((item) => item.data));
  } catch (error) {
    logger.error("Error in batch job upsert", {
      error,
      batchSize: batch.length,
    });
    // Re-queue failed items for retry (optional)
    jobRunBuffer.unshift(...batch);
  }
}

// Schedule periodic flushes
function scheduleFlush() {
  if (flushTimer) {
    clearTimeout(flushTimer);
  }
  flushTimer = setTimeout(async () => {
    await flushJobRunBuffer();
    if (jobRunBuffer.length > 0) {
      scheduleFlush(); // Reschedule if there are still items
    }
  }, FLUSH_INTERVAL);
}

// Queue a job run for batched processing
let throwToLargeAlert = false;
function queueJobRun(jobData: JobRunInsert) {
  jobRunBuffer.push({ data: jobData });

  // Flush immediately if buffer is full
  if (jobRunBuffer.length >= FLUSH_SIZE) {
    setTimeout(flushJobRunBuffer, 0);
  } else {
    // Schedule a flush if not already scheduled
    scheduleFlush();
  }

  // Log a warning if the buffer is getting large
  if (jobRunBuffer.length >= FLUSH_SIZE * 5) {
    throwToLargeAlert = true;
    logger.warn("Job run buffer is getting large", {
      postgresBufferSize: jobRunBuffer.length,
    });
  } else if (throwToLargeAlert) {
    throwToLargeAlert = false;
    logger.success("Job run buffer is back to normal", {
      postgresBufferSize: jobRunBuffer.length,
    });
  }
}

export const handleJobChannel = async (_channel: string, message: string) => {
  try {
    const {
      id,
      job,
      isWaiting,
      tags,
      queueName: queue,
    } = JSON.parse(message) as {
      id: string;
      job: JobSnapshot;
      isWaiting?: boolean;
      tags?: string[];
      queueName: string;
    };
    if (!job.id) {
      throw new Error("Job ID is required");
    }
    if (queue === "{test-log}") {
      console.log({ message });
    }
    const validated = formatJobRun({
      workerId: id,
      job,
      queueName: queue,
      tags,
      phase: isWaiting ? "waiting" : "snapshot",
    });

    // Queue for batched processing instead of individual upsert
    queueJobRun(validated);
  } catch (e) {
    logger.error("Error saving job", { error: e, message });
  }
};
