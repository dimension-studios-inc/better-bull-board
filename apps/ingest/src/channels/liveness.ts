import {
  workersTable,
  workerStatsTable,
  workersInsertSchema,
  workerStatsInsertSchema,
} from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { logger } from "@rharkor/logger";
import { sql } from "drizzle-orm";

interface LivenessMessage {
  id: string;
  queueName: string;
  hostname: string;
  pid: number;
  memory: {
    used: number;
    max: number;
  };
  cpu: {
    used: number;
    max: number;
  };
  timestamp: string;
}

export const handleLivenessChannel = async (
  _channel: string,
  message: string,
) => {
  try {
    const data: LivenessMessage = JSON.parse(message);
    
    const now = new Date();
    
    // Upsert worker record
    await db
      .insert(workersTable)
      .values(
        workersInsertSchema.parse({
          workerId: data.id,
          queueName: data.queueName,
          hostname: data.hostname,
          pid: data.pid,
          isActive: true,
          lastSeenAt: now,
          inactiveSince: null, // Clear inactive status when we receive liveness
        })
      )
      .onConflictDoUpdate({
        target: workersTable.workerId,
        set: {
          queueName: data.queueName,
          hostname: data.hostname,
          pid: data.pid,
          isActive: true,
          lastSeenAt: now,
          inactiveSince: null, // Clear inactive status
        },
      });

    // Insert worker stats
    await db.insert(workerStatsTable).values(
      workerStatsInsertSchema.parse({
        workerId: data.id,
        memoryUsed: data.memory.used,
        memoryMax: data.memory.max,
        cpuUsed: data.cpu.used,
        cpuMax: data.cpu.max,
        recordedAt: now,
      })
    );

    logger.debug("Updated worker liveness", {
      workerId: data.id,
      queueName: data.queueName,
      hostname: data.hostname,
    });
  } catch (error) {
    logger.error("Failed to handle liveness message", { error, message });
  }
};

export const markInactiveWorkers = async () => {
  try {
    // Mark workers as inactive if not seen for more than 1 minute
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    
    const result = await db
      .update(workersTable)
      .set({
        isActive: false,
        inactiveSince: sql`CURRENT_TIMESTAMP`,
      })
      .where(
        sql`${workersTable.isActive} = true AND ${workersTable.lastSeenAt} < ${oneMinuteAgo}`
      );

    if (result.rowCount && result.rowCount > 0) {
      logger.info(`Marked ${result.rowCount} workers as inactive`);
    }
  } catch (error) {
    logger.error("Failed to mark inactive workers", { error });
  }
};