import { exec } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { db } from "@better-bull-board/db/server";
import { logger } from "@rharkor/logger";
import { sql } from "drizzle-orm";
import { env } from "./lib/env";

const execAsync = promisify(exec);

/**
 * Runs database migrations for both PostgreSQL and ClickHouse
 * Only executes when ENV is set to 'production'
 */
export async function migrateDatabases(): Promise<void> {
  // Only run migrations in production
  if (env.ENV !== "production") {
    logger.log("🚫 Skipping database migrations - not in production environment");
    return;
  }

  logger.log("🌟 Starting database migrations in production environment");

  try {
    // Run PostgreSQL migrations using Drizzle
    await migratePostgreSQL();

    logger.log("✅ All database migrations completed successfully");
  } catch (error) {
    logger.error("❌ Database migration failed", error);
    throw error;
  }
}

/**
 * Migrates PostgreSQL database using Drizzle
 */
async function migratePostgreSQL(): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('better-bull-board:migrations'))`);

      // Run drizzle-kit migrate command
      const { stderr } = await execAsync("npx drizzle-kit migrate", {
        cwd: path.resolve(process.cwd(), "packages/db"),
        env: {
          ...process.env,
          DATABASE_URL: process.env.DATABASE_URL,
        },
      });

      if (stderr) {
        // Filter out npm notices and warnings
        const filteredStderr = stderr
          .split("\n")
          .filter((line) => !line.trim().startsWith("npm notice") && !line.toLowerCase().includes("warning"))
          .join("\n");

        if (filteredStderr.trim()) {
          logger.error("PostgreSQL migration error:", filteredStderr);
        }
      }
    });
  } catch (error) {
    logger.error("❌ PostgreSQL migration failed", error);
    throw new Error(`PostgreSQL migration failed: ${error}`);
  }
}
