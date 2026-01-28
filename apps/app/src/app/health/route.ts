import { db } from "@better-bull-board/db/server";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { redis } from "~/lib/redis";

interface HealthCheckResult {
  service: string;
  status: "healthy" | "unhealthy";
  responseTime?: number;
  error?: string;
}

async function checkRedis(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    await redis.ping();
    return {
      service: "redis",
      status: "healthy",
      responseTime: Date.now() - start,
    };
  } catch (error) {
    return {
      service: "redis",
      status: "unhealthy",
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function checkDatabase(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    // Simple query to test PostgreSQL connection
    await db.execute(sql`SELECT 1`);
    return {
      service: "postgresql",
      status: "healthy",
      responseTime: Date.now() - start,
    };
  } catch (error) {
    return {
      service: "postgresql",
      status: "unhealthy",
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function GET() {
  const startTime = Date.now();

  try {
    // Run all health checks in parallel
    const [redisResult, dbResult] = await Promise.all([checkRedis(), checkDatabase()]);

    const results = [redisResult, dbResult];
    const totalResponseTime = Date.now() - startTime;

    // Check if all services are healthy
    const allHealthy = results.every((result) => result.status === "healthy");

    const response = {
      status: allHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      totalResponseTime,
      services: results,
    };

    // Return 200 if all healthy, 503 if any service is unhealthy
    return NextResponse.json(response, {
      status: allHealthy ? 200 : 503,
    });
  } catch (error) {
    const response = {
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      totalResponseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
      services: [],
    };

    return NextResponse.json(response, { status: 503 });
  }
}
