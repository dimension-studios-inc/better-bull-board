import { normalizeClientRegistration, toOAuthErrorResponse } from "~/lib/mcp/oauth"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    const client = await normalizeClientRegistration(body)

    return Response.json(client, { status: 201 })
  } catch (error) {
    return toOAuthErrorResponse(error)
  }
}
