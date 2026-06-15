import { revokeToken, toOAuthErrorResponse } from "~/lib/mcp/oauth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await revokeToken(await request.formData());
    return new Response(null, { status: 200 });
  } catch (error) {
    return toOAuthErrorResponse(error);
  }
}
