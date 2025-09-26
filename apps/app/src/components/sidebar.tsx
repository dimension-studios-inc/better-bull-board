"use client";

import { Home, List, Server, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "~/lib/utils";
import { useAuth } from "~/lib/auth-context";
import { Button } from "~/components/ui/button";

const navigation = [
  { name: "Home", href: "/", icon: Home },
  { name: "Queues", href: "/queues", icon: Server },
  { name: "Runs", href: "/runs", icon: List },
];

export function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border relative">
      <div className="p-6">
        <h1 className="text-xl font-bold text-sidebar-foreground">
          BullMQ Dashboard
        </h1>
      </div>
      <nav className="px-4 space-y-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
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
          );
        })}
      </nav>
      
      {/* User info and logout */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-sidebar-border">
        <div className="text-xs text-sidebar-foreground/70 mb-2">
          Logged in as: {user?.email}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={logout}
          className="w-full flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}
