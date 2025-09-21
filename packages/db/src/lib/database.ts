/* eslint-disable no-process-env */
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { logger } from "@rharkor/logger"

const unknownRelationErrorRegex = /relation ".*" does not exist/

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set")
}

const RESULT_SIZE_THRESHOLD = 500 * 1024 // 500 KB

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const origQuery = pool.query.bind(pool)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
pool.query = async (...args: any[]) => {
  const start = Date.now()
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (origQuery as any)(...args)
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
          1
        )} KB, ${result.rowCount ?? "?"} rows), took ${elapsed}ms`,
        args
      )
    }

    return result
  } catch (err) {
    const formattedError = err instanceof Error ? err.message : String(err)

    // Only log if the error is specifically about SampleRequest relation not existing
    if (formattedError.match(unknownRelationErrorRegex)) {
      const client = await pool.connect()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { host, port, database, user } = (client as any).connectionParameters
      client.release()

      logger.error(`[DB Middleware] Error in query: ${formattedError}`, {
        connectionInfo: { host, port, database, user },
      })
    }

    throw err
  }
}

export const db = drizzle({ client: pool })
