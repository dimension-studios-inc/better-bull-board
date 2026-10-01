import { cn } from "cn"
import { LoaderIcon } from "lucide-react"

export function Loader({ className }: { className?: string }) {
  return (
    <span className="animate-pulse">
      <LoaderIcon className={cn("size-4 animate-spin", className)} />
    </span>
  )
}
