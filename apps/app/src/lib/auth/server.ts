import { createHash, timingSafeEqual } from "node:crypto"

import { jwtVerify, SignJWT } from "jose"
import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies"
import { cookies, headers } from "next/headers"

import { env } from "../env"
import { COOKIE_NAME } from "./client"

const JWT_SECRET = new TextEncoder().encode(env.JWT_SECRET)

export interface User {
  email: string
}

// Hashing first gives equal-length buffers, so the comparison doesn't leak the secret's length either
const sha256 = (value: string) => createHash("sha256").update(value).digest()
const safeEqual = (a: string, b: string) => timingSafeEqual(sha256(a), sha256(b))

/**
 * Verify admin credentials in constant time
 */
export function verifyAdminCredentials(email: string, password: string): boolean {
  // Compare both before deciding, so the response time doesn't reveal whether the email matched
  const emailMatches = safeEqual(email, env.ADMIN_EMAIL)
  const passwordMatches = safeEqual(password, env.ADMIN_PASSWORD)
  return emailMatches && passwordMatches
}

/**
 * Create a JWT token for the user
 */
export async function createToken(user: User): Promise<string> {
  return await new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1y")
    .sign(JWT_SECRET)
}

/**
 * Verify and decode a JWT token
 */
async function verifyToken(token: string): Promise<User | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return { email: payload.email as string }
  } catch {
    return null
  }
}

/**
 * Extract token from request headers or cookies
 */
async function getTokenFromRequest(): Promise<string | null> {
  // Bearer first, so non-browser clients (CLIs, scripts) don't have to send a cookie
  const authHeader = (await headers()).get("authorization")
  const bearerToken = authHeader?.match(/^bearer\s+(.+)$/i)?.[1]?.trim()
  if (bearerToken) {
    return bearerToken
  }

  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value ?? null
}

/**
 * Create auth cookie string
 */
export async function createAuthCookie(token: string): Promise<ResponseCookies> {
  const cookieStore = await cookies()
  return cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  })
}

/**
 * Create logout cookie string
 */
export async function createLogoutCookie(): Promise<ResponseCookies> {
  const cookieStore = await cookies()
  return cookieStore.delete(COOKIE_NAME)
}

/**
 * Check if user is authenticated from request
 */
export async function getAuthenticatedUser(): Promise<User | null> {
  const token = await getTokenFromRequest()
  if (!token) {
    return null
  }

  return await verifyToken(token)
}
