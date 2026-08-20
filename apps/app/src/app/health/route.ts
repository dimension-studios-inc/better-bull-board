import { buildHealthResponse } from "~/lib/health-checks"

export async function GET() {
  return buildHealthResponse()
}
