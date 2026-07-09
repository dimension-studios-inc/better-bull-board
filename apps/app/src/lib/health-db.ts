import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const healthPoolMax = Number(process.env.HEALTH_DATABASE_POOL_MAX ?? 2);
const healthConnectionTimeoutMs = Number(process.env.HEALTH_DATABASE_POOL_CONNECTION_TIMEOUT_MS ?? 2_000);

const healthPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number.isFinite(healthPoolMax) && healthPoolMax > 0 ? healthPoolMax : 2,
  connectionTimeoutMillis:
    Number.isFinite(healthConnectionTimeoutMs) && healthConnectionTimeoutMs > 0 ? healthConnectionTimeoutMs : 2_000,
  options: "-c statement_timeout=2000",
});

export const healthDb = drizzle({ client: healthPool });
