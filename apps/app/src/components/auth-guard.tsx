import { SidebarInset, SidebarProvider } from "@better-bull-board/ui/components/sidebar"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { AppSidebar } from "~/components/app-sidebar"
import { SiteHeader } from "~/components/site-header"
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

  // Restore the collapsed/expanded state persisted by the sidebar
  const sidebarState = (await cookies()).get("sidebar_state")?.value

  // For authenticated users on other pages, render with full layout
  return (
    <SidebarProvider
      defaultOpen={sidebarState !== "false"}
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset className="min-w-0">
        <SiteHeader />
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
