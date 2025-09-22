import { insertJobLog as insertJobLogCH } from "@better-bull-board/clickhouse";
import {
  jobLogsInsertSchema,
  jobLogsTable,
} from "@better-bull-board/db/schemas/job/schema";
import { db } from "@better-bull-board/db/server";
import { logger } from "@rharkor/logger";
import type { z } from "zod/v4";
import { getJobFromBullId } from "~/utils";

export const handleLogChannel = async (_channel: string, message: string) => {
  try {
    const {
      jobId,
      message: logMessage,
      level,
    } = JSON.parse(message) as {
      id: string;
      jobId: string;
      message: string;
      level: string;
    };

    let jobRunId = await getJobFromBullId(jobId);
    if (!jobRunId) {
      // Retry in 1 second
      await new Promise((resolve) => setTimeout(resolve, 1000));
      jobRunId = await getJobFromBullId(jobId);
      if (!jobRunId) {
        logger.warn("No job run found for job ID", { jobId });
        return;
      }
    }

    // Format the log data
    const formatted: z.infer<typeof jobLogsInsertSchema> = {
      jobRunId,
      level: level as "log" | "debug" | "info" | "warn" | "error",
      message: logMessage,
    };

    const validated = jobLogsInsertSchema.parse(formatted);

    // Insert into PostgreSQL
    const [insertedLog] = await db
      .insert(jobLogsTable)
      .values(validated)
      .returning();

    if (!insertedLog) {
      throw new Error("Failed to insert log into database");
    }

    // Insert into ClickHouse
    await insertJobLogCH({
      ...insertedLog,
      job_run_id: insertedLog.jobRunId,
    });
  } catch (e) {
    logger.error("Error saving log", { error: e, message });
  }
};
