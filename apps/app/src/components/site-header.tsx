"use client"

import { Separator } from "@better-bull-board/ui/components/separator"
import { SidebarTrigger } from "@better-bull-board/ui/components/sidebar"
import { ChevronRight } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { decodePathSegment } from "~/lib/utils/path"

type PageInfo = { title: string; parent?: { title: string; href: string } }

const getPageInfo = (pathname: string): PageInfo => {
  if (pathname === "/") return { title: "Dashboard" }
  if (pathname === "/queues") return { title: "Queues" }
  if (pathname === "/schedulers") return { title: "Schedulers" }
  if (pathname === "/runs") return { title: "Runs" }
  if (pathname === "/runs/create")
    return { title: "Create Run", parent: { title: "Runs", href: "/runs" } }
  if (pathname.startsWith("/runs/"))
    return { title: "Run Details", parent: { title: "Runs", href: "/runs" } }
  if (pathname.startsWith("/queues/")) {
    return {
      title: decodePathSegment(pathname.slice("/queues/".length)),
      parent: { title: "Queues", href: "/queues" },
    }
  }
  return { title: "Better Bull Board" }
}

export function SiteHeader() {
  const pathname = usePathname()
  const { title, parent } = getPageInfo(pathname)

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 h-4 data-vertical:self-auto" />
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-base">
          {parent && (
            <>
              <Link
                href={parent.href}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {parent.title}
              </Link>
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
            </>
          )}
          <h1 className="truncate font-medium">{title}</h1>
        </nav>
      </div>
    </header>
  )
}
