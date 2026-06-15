import { exchangeAuthorizationCode, exchangeRefreshToken, toOAuthErrorResponse } from "~/lib/mcp/oauth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const grantType = formData.get("grant_type");

    if (grantType === "authorization_code") {
      const { rowId: _rowId, ...tokens } = await exchangeAuthorizationCode(formData);
      return Response.json(tokens);
    }

    if (grantType === "refresh_token") {
      return Response.json(await exchangeRefreshToken(formData));
    }

    return Response.json({ error: "unsupported_grant_type" }, { status: 400 });
  } catch (error) {
    return toOAuthErrorResponse(error);
  }
}
