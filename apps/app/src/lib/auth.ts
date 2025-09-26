import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { env } from './env';

const JWT_SECRET = new TextEncoder().encode(env.JWT_SECRET);
const COOKIE_NAME = 'auth-token';

export interface User {
  email: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
}

/**
 * Verify admin credentials
 */
export async function verifyAdminCredentials(email: string, password: string): Promise<boolean> {
  if (email !== env.ADMIN_EMAIL) {
    return false;
  }
  
  // For simple authentication, we can do a direct comparison
  // In production, you might want to hash the password in the env
  return password === env.ADMIN_PASSWORD;
}

/**
 * Create a JWT token for the user
 */
export async function createToken(user: User): Promise<string> {
  return await new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1y')
    .sign(JWT_SECRET);
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<User | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { email: payload.email as string };
  } catch {
    return null;
  }
}

/**
 * Extract token from request headers or cookies
 */
export function getTokenFromRequest(request: Request): string | null {
  // Try Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Try cookie - fallback to manual parsing since cookies-next expects NextRequest
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    
    return cookies[COOKIE_NAME] || null;
  }

  return null;
}

/**
 * Create auth cookie string
 */
export function createAuthCookie(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${365 * 24 * 60 * 60}; SameSite=Strict${secure}`;
}

/**
 * Create logout cookie string
 */
export function createLogoutCookie(): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict${secure}`;
}

/**
 * Check if user is authenticated from request
 */
export async function getAuthenticatedUser(request: Request): Promise<User | null> {
  const token = getTokenFromRequest(request);
  if (!token) {
    return null;
  }
  
  return await verifyToken(token);
}