import { sql } from "drizzle-orm"
import { NextResponse } from "next/server"
import { healthDb } from "~/lib/health-db"
import { redis } from "~/lib/redis"

export const HEALTH_CHECK_TIMEOUT_MS = 2_000

interface HealthCheckResult {
  service: string
  status: "healthy" | "unhealthy"
  responseTime?: number
  error?: string
}

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, service: string): Promise<T> => {
  let timeout: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`${service} health check timed out after ${timeoutMs}ms`))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function checkRedis(): Promise<HealthCheckResult> {
  const start = Date.now()
  try {
    await withTimeout(redis.ping(), HEALTH_CHECK_TIMEOUT_MS, "redis")
    return {
      service: "redis",
      status: "healthy",
      responseTime: Date.now() - start,
    }
  } catch (error) {
    return {
      service: "redis",
      status: "unhealthy",
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

async function checkDatabase(): Promise<HealthCheckResult> {
  const start = Date.now()
  try {
    await withTimeout(healthDb.execute(sql`SELECT 1`), HEALTH_CHECK_TIMEOUT_MS, "postgresql")
    return {
      service: "postgresql",
      status: "healthy",
      responseTime: Date.now() - start,
    }
  } catch (error) {
    return {
      service: "postgresql",
      status: "unhealthy",
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function buildHealthResponse() {
  const startTime = Date.now()

  try {
    const [redisResult, dbResult] = await Promise.all([checkRedis(), checkDatabase()])
    const results = [redisResult, dbResult]
    const allHealthy = results.every((result) => result.status === "healthy")

    return NextResponse.json(
      {
        status: allHealthy ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString(),
        totalResponseTime: Date.now() - startTime,
        services: results,
      },
      { status: allHealthy ? 200 : 503 },
    )
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        totalResponseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
        services: [],
      },
      { status: 503 },
    )
  }
}
