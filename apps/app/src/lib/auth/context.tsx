"use client"

import { deleteCookie } from "cookies-next/client"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import { COOKIE_NAME } from "./client"

interface User {
  email: string
}

type AuthResponse = { success?: boolean; user?: User; error?: string }

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
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

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Check auth status on mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      // Never rejects: errors resolve to `null` (not authenticated)
      const currentUser = await fetchCurrentUser()
      if (currentUser) {
        setUser(currentUser)
      }
      setLoading(false)
    }
    void checkAuthStatus()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      })

      const data = (await response.json()) as AuthResponse

      if (data.success) {
        setUser(data.user ?? null)
        return { success: true }
      } else {
        return { success: false, error: data.error }
      }
    } catch {
      return { success: false, error: "Network error. Please try again." }
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {
      // Ignore errors
    } finally {
      // Delete the cookie on client side
      deleteCookie(COOKIE_NAME)
      setUser(null)
    }
  }, [])

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
