import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "~/lib/auth/server";
import {
  createAuthorizationCode,
  createOAuthErrorRedirect,
  getMcpResource,
  getOrigin,
  validateAuthorizationRequest,
} from "~/lib/mcp/oauth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await request.formData();
  const rawAuthorizeUrl = formData.get("authorize_url");

  if (typeof rawAuthorizeUrl !== "string") {
    return NextResponse.json({ error: "Missing authorization request" }, { status: 400 });
  }

  const origin = getOrigin(request);
  const resource = getMcpResource(origin);
  const authorizeUrl = new URL(rawAuthorizeUrl, origin);
  const authorization = await validateAuthorizationRequest(authorizeUrl, {
    expectedResource: resource,
  });

  if (formData.get("decision") !== "approve") {
    return NextResponse.redirect(
      createOAuthErrorRedirect({
        redirectUri: authorization.redirectUri,
        error: "access_denied",
        description: "The authorization request was denied",
        state: authorization.state,
      }),
    );
  }

  const code = await createAuthorizationCode({
    clientId: authorization.client.clientId,
    redirectUri: authorization.redirectUri,
    scope: authorization.scope,
    codeChallenge: authorization.codeChallenge,
    codeChallengeMethod: authorization.codeChallengeMethod,
    resource: authorization.resource,
    subject: user.email,
  });

  const redirectUri = new URL(authorization.redirectUri);
  redirectUri.searchParams.set("code", code);
  if (authorization.state) {
    redirectUri.searchParams.set("state", authorization.state);
  }

  return NextResponse.redirect(redirectUri);
}
