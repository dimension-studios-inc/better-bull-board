import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createAuthCookie,
  createToken,
  verifyAdminCredentials,
} from "~/lib/auth/server";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    // Verify credentials
    const isValid = await verifyAdminCredentials(email, password);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 },
      );
    }

    // Create token
    const user = { email };
    const token = await createToken(user);

    await createAuthCookie(token);

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 },
    );
  }
}
