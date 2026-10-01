"use client"

import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "./ui/button"

export function PageTitle({
  title,
  description,
  withBackButton,
}: {
  title: string
  description: string
  withBackButton?: boolean
}) {
  const router = useRouter()

  const handleGoBack = () => {
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push("/runs")
    }
  }

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        {withBackButton && (
          <Button variant="ghost" size={"sm"} onClick={handleGoBack}>
            <ArrowLeft className="size-4" />
          </Button>
        )}
        <h1 className="text-2xl font-bold text-foreground break-all md:text-3xl">{title}</h1>
      </div>
      <p className="text-muted-foreground break-words">{description}</p>
    </div>
  )
}
