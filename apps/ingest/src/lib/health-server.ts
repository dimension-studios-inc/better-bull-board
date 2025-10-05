import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { URL } from "node:url";
import { db } from "@better-bull-board/db/server";
import { logger } from "@rharkor/logger";
import { sql } from "drizzle-orm";
import { redis } from "./redis";

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

async function handleHealthCheck(): Promise<{
  response: string;
  statusCode: number;
}> {
  const startTime = Date.now();

  try {
    // Run all health checks in parallel
    const [redisResult, dbResult] = await Promise.all([
      checkRedis(),
      checkDatabase(),
    ]);

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
    return {
      response: JSON.stringify(response, null, 2),
      statusCode: allHealthy ? 200 : 503,
    };
  } catch (error) {
    const response = {
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      totalResponseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
      services: [],
    };

    return {
      response: JSON.stringify(response, null, 2),
      statusCode: 503,
    };
  }
}

function handleRequest(req: IncomingMessage, res: ServerResponse) {
  // biome-ignore lint/style/noNonNullAssertion: _
  const url = new URL(req.url!, `http://${req.headers.host}`);

  // Enable CORS for health checks
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    handleHealthCheck()
      .then(({ response, statusCode }) => {
        res.setHeader("Content-Type", "application/json");
        res.writeHead(statusCode);
        res.end(response);
      })
      .catch((error) => {
        logger.error("Health check error:", error);
        res.setHeader("Content-Type", "application/json");
        res.writeHead(500);
        res.end(
          JSON.stringify(
            {
              status: "unhealthy",
              error: "Internal server error",
              timestamp: new Date().toISOString(),
            },
            null,
            2,
          ),
        );
      });
    return;
  }

  // Handle 404 for unknown routes
  res.setHeader("Content-Type", "application/json");
  res.writeHead(404);
  res.end(
    JSON.stringify(
      {
        error: "Not found",
        message: "Only /health endpoint is available",
      },
      null,
      2,
    ),
  );
}

export function startHealthServer(port: number = 3001): void {
  const server = createServer(handleRequest);

  server.listen(port, () => {
    logger.log(`🏥 Health server listening on port ${port}`);
  });

  server.on("error", (error) => {
    logger.error("Health server error:", error);
  });
}
