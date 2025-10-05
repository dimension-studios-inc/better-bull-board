import { exec } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { logger } from "@rharkor/logger";
import { env } from "./lib/env";

const execAsync = promisify(exec);

/**
 * Runs database migrations for both PostgreSQL and ClickHouse
 * Only executes when ENV is set to 'production'
 */
export async function migrateDatabases(): Promise<void> {
  // Only run migrations in production
  if (env.ENV !== "production") {
    logger.log(
      "🚫 Skipping database migrations - not in production environment",
    );
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
  logger.log("📊 Starting PostgreSQL migrations...");

  try {
    // Run drizzle-kit migrate command
    const { stderr } = await execAsync("npx drizzle-kit migrate", {
      cwd: path.resolve(process.cwd(), "packages/db"),
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL,
      },
    });

    if (stderr && !stderr.includes("warning")) {
      logger.warn("PostgreSQL migration warnings:", stderr);
    }

    logger.log("✅ PostgreSQL migrations completed");
  } catch (error) {
    logger.error("❌ PostgreSQL migration failed", error);
    throw new Error(`PostgreSQL migration failed: ${error}`);
  }
}
