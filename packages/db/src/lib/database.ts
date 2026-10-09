import { logger } from "@rharkor/logger"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool, type QueryResult } from "pg"

const unknownRelationErrorRegex = /relation ".*" does not exist/

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set")
}

const RESULT_SIZE_THRESHOLD = 500 * 1024 // 500 KB

const poolMax = Number(process.env.DATABASE_POOL_MAX ?? 20)
const connectionTimeoutMillis = Number(process.env.DATABASE_POOL_CONNECTION_TIMEOUT_MS ?? 5_000)
const statementTimeoutMs = Number(process.env.DATABASE_STATEMENT_TIMEOUT_MS ?? 30_000)

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 20,
  connectionTimeoutMillis:
    Number.isFinite(connectionTimeoutMillis) && connectionTimeoutMillis > 0
      ? connectionTimeoutMillis
      : 5_000,
  options: `-c statement_timeout=${Number.isFinite(statementTimeoutMs) && statementTimeoutMs > 0 ? statementTimeoutMs : 30_000}`,
})

pool.on("error", (err) => {
  logger.error("[DB Pool] Idle client error", {
    message: err.message,
    stack: err.stack,
  })
})

type PgConnectionParameters = { host: string; port: number; database: string; user: string }

// pool.query is overloaded: the wrapper forwards whatever arguments it gets and is cast back to its type.
const origQuery = pool.query.bind(pool) as (...args: unknown[]) => Promise<QueryResult>
pool.query = (async (...args: unknown[]) => {
  const start = Date.now()
  try {
    const result = await origQuery(...args)
    const elapsed = Date.now() - start

    let size = 0
    try {
      size = Buffer.byteLength(JSON.stringify(result.rows))
    } catch {
      // ignore
    }

    if (size > RESULT_SIZE_THRESHOLD) {
      logger.warn(
        `[DB Middleware] Large result (~${(size / 1024).toFixed(
          1,
        )} KB, ${result.rowCount ?? "?"} rows), took ${elapsed}ms`,
        args,
      )
    }

    return result
  } catch (err) {
    const formattedError = err instanceof Error ? err.message : String(err)

    // Only log if the error is specifically about SampleRequest relation not existing
    if (formattedError.match(unknownRelationErrorRegex)) {
      const client = await pool.connect()
      // Set by pg's Client but missing from its types.
      const { host, port, database, user } = (
        client as unknown as { connectionParameters: PgConnectionParameters }
      ).connectionParameters
      client.release()

      logger.error(`[DB Middleware] Error in query: ${formattedError}`, {
        connectionInfo: { host, port, database, user },
      })
    }

    throw err
  }
}) as typeof pool.query

export const db = drizzle({ client: pool })
