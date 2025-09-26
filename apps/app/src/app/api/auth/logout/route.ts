import { NextResponse } from "next/server";
import { createLogoutCookie } from "~/lib/auth/server";

export async function POST() {
  await createLogoutCookie();
  return NextResponse.json({ success: true });
}
