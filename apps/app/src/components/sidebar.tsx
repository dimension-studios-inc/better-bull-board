"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Home, List, LogOut, Menu, Server, X } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Button } from "~/components/ui/button"
import { useAuth } from "~/lib/auth/context"
import { cn } from "~/lib/utils/client"

const navigation = [
  { name: "Home", href: "/", icon: Home },
  { name: "Queues", href: "/queues", icon: Server },
  { name: "Runs", href: "/runs", icon: List },
]

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { logout, user } = useAuth()

  return (
    <>
      <nav className="px-4 space-y-2 flex-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* User info and logout */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="text-xs text-sidebar-foreground/70 mb-2 truncate">Logged in as: {user?.email}</div>
        <Button variant="outline" size="sm" onClick={logout} className="w-full flex items-center gap-2">
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </>
  )
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="p-6">
          <h1 className="text-xl font-bold text-sidebar-foreground leading-none">Better Bull Board</h1>
        </div>
        <SidebarNav />
      </aside>

      {/* Mobile top bar + drawer */}
      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <header className="md:hidden flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border bg-sidebar px-4">
          <DialogPrimitive.Trigger asChild>
            <Button variant="ghost" size="icon" className="-ml-2" aria-label="Open navigation">
              <Menu className="size-5" />
            </Button>
          </DialogPrimitive.Trigger>
          <span className="text-lg font-bold text-sidebar-foreground leading-none">Better Bull Board</span>
        </header>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="md:hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50" />
          <DialogPrimitive.Content className="md:hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-sidebar border-r border-sidebar-border shadow-lg duration-200">
            <div className="flex items-center justify-between p-4">
              <DialogPrimitive.Title className="text-lg font-bold text-sidebar-foreground leading-none">
                Better Bull Board
              </DialogPrimitive.Title>
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="icon" aria-label="Close navigation">
                  <X className="size-5" />
                </Button>
              </DialogPrimitive.Close>
            </div>
            <DialogPrimitive.Description className="sr-only">Main navigation</DialogPrimitive.Description>
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}
