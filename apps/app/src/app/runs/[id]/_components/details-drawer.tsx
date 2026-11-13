"use client"

import { Button } from "@better-bull-board/ui/components/button"
import { DrawerClose, DrawerHeader } from "@better-bull-board/ui/components/drawer"
import { cn } from "cn"
import { XIcon } from "lucide-react"

/** Header shared by the run and log details: the drawer can be closed from any of its views */
export function DetailsDrawerHeader({ children }: { children: React.ReactNode }) {
  return (
    <DrawerHeader>
      <div className="flex items-center gap-2">
        {children}
        <DrawerClose render={<Button variant="ghost" size="icon" aria-label="Close details" />}>
          <XIcon />
        </DrawerClose>
      </div>
    </DrawerHeader>
  )
}

/** A flex item, not `h-full`: a bottom drawer sizes itself to its content */
export function DetailsDrawerBody({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto p-4", className)}>{children}</div>
}
