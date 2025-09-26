import { jwtVerify, SignJWT } from "jose";
import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";
import { cookies } from "next/headers";
import { env } from "../env";
import { COOKIE_NAME } from "./client";

const JWT_SECRET = new TextEncoder().encode(env.JWT_SECRET);

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
export async function verifyAdminCredentials(
  email: string,
  password: string,
): Promise<boolean> {
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
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1y")
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
export async function getTokenFromRequest(): Promise<string | null> {
  const cookieStore = await cookies();
  // Try Authorization header first
  const authHeader = cookieStore.get(COOKIE_NAME);
  return authHeader?.value ?? null;
}

/**
 * Create auth cookie string
 */
export async function createAuthCookie(
  token: string,
): Promise<ResponseCookies> {
  const cookieStore = await cookies();
  return cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
}

/**
 * Create logout cookie string
 */
export async function createLogoutCookie(): Promise<ResponseCookies> {
  const cookieStore = await cookies();
  return cookieStore.delete(COOKIE_NAME);
}

/**
 * Check if user is authenticated from request
 */
export async function getAuthenticatedUser(): Promise<User | null> {
  const token = await getTokenFromRequest();
  if (!token) {
    return null;
  }

  return await verifyToken(token);
}
