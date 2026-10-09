"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { deleteCookie } from "cookies-next/client"
import { createContext, type ReactNode, useCallback, useContext, useMemo } from "react"

import { COOKIE_NAME } from "./client"

interface User {
  email: string
}

type AuthResponse = { success?: boolean; user?: User; error?: string }

interface AuthContextType {
  user: User | null
  loading: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

async function fetchCurrentUser(): Promise<User | null> {
  try {
    const response = await fetch("/api/auth/me")
    if (response.ok) {
      const data = (await response.json()) as AuthResponse
      if (data.success && data.user) {
        return data.user
      }
    }
  } catch {
    // Ignore errors - user is not authenticated
  }
  return null
}

const CURRENT_USER_QUERY_KEY = ["auth/me"]

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient()
  // Never rejects: errors resolve to `null` (not authenticated)
  const { data: user = null, isPending: loading } = useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: fetchCurrentUser,
    staleTime: Number.POSITIVE_INFINITY,
  })

  const logout = useCallback(async () => {
    // Signed out on this side even when the request fails
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined)
    // Delete the cookie on client side
    deleteCookie(COOKIE_NAME)
    queryClient.setQueryData(CURRENT_USER_QUERY_KEY, null)
  }, [queryClient])

  const value = useMemo(() => ({ user, loading, logout }), [user, loading, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
