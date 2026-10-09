#!/usr/bin/env bun

import { timingSafeEqual } from "node:crypto"
import { createServer, type ServerResponse } from "node:http"

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"

import { env } from "./env"
import { createBetterBullBoardMcpServer } from "./server"

if (!env.BBB_MCP_TOKEN) {
  console.error(
    JSON.stringify({
      level: "error",
      message: "BBB_MCP_TOKEN is required when running the standalone Better Bull Board MCP server",
    }),
  )
  process.exit(1)
}

const mcpToken = env.BBB_MCP_TOKEN

const sendJson = (res: ServerResponse, statusCode: number, body: unknown) => {
  res.writeHead(statusCode, { "Content-Type": "application/json" })
  res.end(JSON.stringify(body))
}

const isAuthorized = (authorization: string | undefined) => {
  const bearerPrefix = "Bearer "

  if (!authorization?.startsWith(bearerPrefix)) {
    return false
  }

  const actualToken = Buffer.from(authorization.slice(bearerPrefix.length))
  const expectedToken = Buffer.from(mcpToken)

  return actualToken.length === expectedToken.length && timingSafeEqual(actualToken, expectedToken)
}

const httpServer = createServer(async (req, res) => {
  if (req.url !== "/mcp") {
    sendJson(res, 404, { error: "Not found" })
    return
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" })
    return
  }

  if (!isAuthorized(req.headers.authorization)) {
    sendJson(res, 401, { error: "Unauthorized" })
    return
  }

  try {
    const server = createBetterBullBoardMcpServer()
    const transport = new StreamableHTTPServerTransport({
      enableJsonResponse: true,
      sessionIdGenerator: undefined,
    })

    res.on("close", () => {
      transport.close()
    })

    await server.connect(transport)
    await transport.handleRequest(req, res)
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "MCP request failed",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    )

    if (!res.headersSent) {
      sendJson(res, 500, { error: "Internal server error" })
    } else {
      res.end()
    }
  }
})

httpServer.on("error", (error) => {
  console.error(
    JSON.stringify({
      level: "error",
      message: "Better Bull Board MCP server failed to listen",
      error: error instanceof Error ? error.message : "Unknown error",
    }),
  )
  process.exit(1)
})

httpServer.listen(env.BBB_MCP_PORT, env.BBB_MCP_HOST, () => {
  console.error(
    JSON.stringify({
      level: "info",
      message: "Better Bull Board MCP server listening",
      host: env.BBB_MCP_HOST,
      port: env.BBB_MCP_PORT,
      path: "/mcp",
    }),
  )
})

const shutdown = (signal: NodeJS.Signals) => {
  console.error(JSON.stringify({ level: "info", message: `Received ${signal}, shutting down` }))
  // In-flight requests finish; a connection still open after 10 s is cut.
  setTimeout(() => process.exit(1), 10_000).unref()
  httpServer.close(() => process.exit(0))
  httpServer.closeIdleConnections()
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => shutdown(signal))
}
