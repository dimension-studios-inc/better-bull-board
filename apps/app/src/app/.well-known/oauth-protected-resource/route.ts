import { getMcpResource, getOrigin } from "~/lib/mcp/oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request) {
  const origin = getOrigin(request);

  return Response.json({
    resource: getMcpResource(origin),
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    scopes_supported: ["bbb:read"],
    resource_name: "Better Bull Board MCP",
  });
}
