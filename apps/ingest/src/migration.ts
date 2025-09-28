import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { clickhouseClient } from "@better-bull-board/clickhouse/client";
import { logger } from "@rharkor/logger";
import { v7 as uuidv7 } from "uuid";
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

    // Run ClickHouse migrations
    await migrateClickHouse();

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
    const { stdout, stderr } = await execAsync("npx drizzle-kit migrate", {
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
    logger.log("PostgreSQL migration output:", stdout);
  } catch (error) {
    logger.error("❌ PostgreSQL migration failed", error);
    throw new Error(`PostgreSQL migration failed: ${error}`);
  }
}

/**
 * Migrates ClickHouse database using the existing migration script
 */
async function migrateClickHouse(): Promise<void> {
  logger.log("📊 Starting ClickHouse migrations...");

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const MIGRATIONS_DIR = path.resolve(
      __dirname,
      "../../../packages/clickhouse/src/migrations",
    );

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let migrations: string[] | null = null;

    for (const file of files) {
      if (!file.startsWith("000_")) {
        const loadMigrations = async () => {
          if (migrations) return;
          try {
            const migrationsQuery = await clickhouseClient.query({
              query: "SELECT name FROM migrations_ch",
            });
            const migrationsJson = (await migrationsQuery.json()).data as {
              name: string;
            }[];
            migrations = migrationsJson.map((m) => m.name);
          } catch {
            // If migrations table doesn't exist yet, start with empty array
            logger.log("Migrations table not found, starting fresh");
            migrations = [];
          }
        };
        await loadMigrations();
        if ((migrations as string[] | null)?.includes(file)) {
          logger.log(`✅ Skipping migration: ${file}`);
          continue;
        }
      }

      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, "utf8");
      logger.log(`➡️  Running migration: ${file}`);

      try {
        await clickhouseClient.command({
          query: sql,
          clickhouse_settings: { wait_end_of_query: 1 },
        });
        await clickhouseClient.insert({
          table: "migrations_ch",
          values: [
            {
              id: uuidv7(),
              name: file,
              applied_at: Date.now(),
            },
          ],
          format: "JSONEachRow",
        });
        logger.log(`✅ Done: ${file}`);
      } catch (err) {
        logger.error(`❌ Failed: ${file}`, err);
        throw new Error(`ClickHouse migration failed for ${file}: ${err}`);
      }
    }

    logger.log("✅ ClickHouse migrations completed");
  } catch (error) {
    logger.error("❌ ClickHouse migration failed", error);
    throw new Error(`ClickHouse migration failed: ${error}`);
  } finally {
    // Close ClickHouse connection
    try {
      await clickhouseClient.close();
    } catch (error) {
      logger.warn("Warning: Failed to close ClickHouse connection", error);
    }
  }
}
