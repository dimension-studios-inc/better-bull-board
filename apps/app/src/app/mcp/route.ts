import { createBetterBullBoardMcpServer } from "@better-bull-board/mcp/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getMcpResource, getOrigin, verifyAccessToken } from "~/lib/mcp/oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bearerPrefix = "Bearer ";

const unauthorized = (request: Request) =>
  Response.json(
    { error: "Unauthorized" },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": `Bearer resource_metadata="${getOrigin(request)}/.well-known/oauth-protected-resource"`,
      },
    },
  );

const getBearerToken = (request: Request) => {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith(bearerPrefix)) {
    return null;
  }

  return authorization.slice(bearerPrefix.length);
};

const handleMcpRequest = async (request: Request) => {
  const token = getBearerToken(request);
  const authInfo = token ? await verifyAccessToken(token, getMcpResource(getOrigin(request))) : null;

  if (!authInfo) {
    return unauthorized(request);
  }

  const server = createBetterBullBoardMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
    sessionIdGenerator: undefined,
  });

  await server.connect(transport);

  try {
    return await transport.handleRequest(request, { authInfo });
  } finally {
    await server.close();
  }
};

export const GET = handleMcpRequest;
export const POST = handleMcpRequest;
export const DELETE = handleMcpRequest;
