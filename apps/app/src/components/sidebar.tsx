"use client";

import { Home, List, Server } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "~/lib/utils";

const navigation = [
  { name: "Home", href: "/", icon: Home },
  { name: "Queues", href: "/queues", icon: Server },
  { name: "Runs", href: "/runs", icon: List },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border">
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
    </div>
  );
}
