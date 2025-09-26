import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from './lib/auth';

// Define which paths require authentication
const protectedPaths = ['/api/jobs', '/api/queues'];
const authPaths = ['/api/auth'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip authentication for auth endpoints
  if (authPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check if the path requires authentication
  const isProtectedAPI = protectedPaths.some(path => pathname.startsWith(path));
  
  if (isProtectedAPI) {
    const user = await getAuthenticatedUser(request);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
  }

  // For non-API routes (pages), we'll handle auth in the client
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};