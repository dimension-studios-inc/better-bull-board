import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '~/lib/auth';

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Not authenticated' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    user,
  });
}