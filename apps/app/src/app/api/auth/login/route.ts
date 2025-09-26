import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminCredentials, createToken, createAuthCookie } from '~/lib/auth';

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
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Create token
    const user = { email };
    const token = await createToken(user);

    // Create response with cookie
    const response = NextResponse.json({
      success: true,
      user,
    });

    response.headers.set('Set-Cookie', createAuthCookie(token));

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 400 }
    );
  }
}