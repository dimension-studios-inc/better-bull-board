import { redirect } from "next/navigation"
import { Sidebar } from "~/components/sidebar"
import { getAuthenticatedUser } from "~/lib/auth/server"

interface AuthGuardProps {
  children: React.ReactNode
  pathname: string
}

export async function AuthGuard({ children, pathname }: AuthGuardProps) {
  const user = await getAuthenticatedUser()

  if (!user && pathname !== "/login") {
    redirect(`/login?next=${encodeURIComponent(pathname)}`)
  }

  if (pathname === "/login" || pathname === "/mcp/authorize") {
    // If on login or MCP approval page, render without sidebar
    return <>{children}</>
  }

  // For authenticated users on other pages, render with full layout
  return (
    <div className="flex h-dvh flex-col bg-background md:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-auto">{children}</main>
    </div>
  )
}
