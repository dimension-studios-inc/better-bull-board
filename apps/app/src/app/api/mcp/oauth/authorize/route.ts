import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "~/lib/auth/server";
import { getMcpResource, getOrigin, OAuthError, validateAuthorizationRequest } from "~/lib/mcp/oauth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = getOrigin(request);
  const resource = getMcpResource(origin);

  if (!url.searchParams.has("resource")) {
    url.searchParams.set("resource", resource);
  }

  try {
    await validateAuthorizationRequest(url, { expectedResource: resource });
    const user = await getAuthenticatedUser();

    if (!user) {
      const loginUrl = new URL("/login", origin);
      loginUrl.searchParams.set("next", `${url.pathname}${url.search}`);
      return NextResponse.redirect(loginUrl);
    }

    const authorizeUrl = new URL("/mcp/authorize", origin);
    authorizeUrl.search = url.search;
    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof OAuthError ? error.code : "invalid_request",
        error_description: error instanceof Error ? error.message : "Invalid authorization request",
      },
      { status: error instanceof OAuthError ? error.status : 400 },
    );
  }
}
