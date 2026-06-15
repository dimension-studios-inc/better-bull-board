import { MCP_WRITE_SCOPE } from "@better-bull-board/mcp/scopes";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { getAuthenticatedUser } from "~/lib/auth/server";
import { getMcpResource, getOriginFromHeaders, validateAuthorizationRequest } from "~/lib/mcp/oauth";

export const runtime = "nodejs";

const authorizePath = "/api/mcp/oauth/authorize";

export default async function McpAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getAuthenticatedUser();
  const params = await searchParams;
  const headerStore = await headers();
  const origin = getOriginFromHeaders(headerStore);
  const resource = getMcpResource(origin);
  const url = new URL(authorizePath, origin);

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      url.searchParams.set(key, value);
    }
  }
  if (!url.searchParams.has("resource")) {
    url.searchParams.set("resource", resource);
  }

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`${authorizePath}?${url.searchParams.toString()}`)}`);
  }

  const authorization = await validateAuthorizationRequest(url, {
    expectedResource: resource,
  });
  const authorizeUrl = `${authorizePath}?${url.searchParams.toString()}`;
  const requestedScopes = authorization.scope.split(/\s+/);
  const requestsWrite = requestedScopes.includes(MCP_WRITE_SCOPE);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-lg items-center">
        <Card className="w-full p-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Authorize MCP access</h1>
            <p className="text-sm text-muted-foreground">
              {authorization.client.clientName} wants {requestsWrite ? "read and write" : "read-only"} access to Better
              Bull Board.
            </p>
          </div>

          <div className="mt-6 space-y-3 rounded-md border p-4 text-sm">
            <div>
              <div className="font-medium">Signed in as</div>
              <div className="text-muted-foreground">{user.email}</div>
            </div>
            <div>
              <div className="font-medium">Requested access</div>
              <div className="text-muted-foreground">
                {requestsWrite
                  ? "Read queues, jobs, logs, and system overview. Pause, resume, delete queues, cancel jobs, and replay jobs."
                  : "Read queues, jobs, logs, and system overview."}
              </div>
            </div>
          </div>

          <form action="/api/mcp/oauth/authorize/approve" method="post" className="mt-6 flex gap-3">
            <input type="hidden" name="authorize_url" value={authorizeUrl} />
            <Button type="submit" name="decision" value="approve" className="flex-1">
              Authorize
            </Button>
            <Button type="submit" name="decision" value="deny" variant="outline" className="flex-1">
              Deny
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
