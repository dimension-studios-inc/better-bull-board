"use client"

import { TooltipProvider } from "@better-bull-board/ui/components/tooltip"
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { LazyMotion, MotionConfig } from "motion/react"
import { useRouter } from "next/navigation"

import { WebSocketProvider } from "~/hooks/use-websocket"
import { AuthProvider } from "~/lib/auth/context"
import { createQueryClient } from "~/lib/query-client"

let clientQueryClientSingleton: QueryClient | undefined
const getQueryClient = ({ onRedirect }: { onRedirect: (path: string) => void }) => {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return createQueryClient()
  }
  // Browser: use singleton pattern to keep the same query client
  clientQueryClientSingleton ??= createQueryClient((path) => {
    onRedirect(path)
  })

  return clientQueryClientSingleton
}

const loadMotionFeatures = () =>
  import("~/lib/motion-features").then((features) => features.default)

export const Providers = ({
  children,
  WEBSOCKET_URL,
}: {
  children: React.ReactNode
  WEBSOCKET_URL: string
}) => {
  const router = useRouter()
  const queryClient = getQueryClient({
    onRedirect: (path) => {
      router.push(path)
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WebSocketProvider
          options={{
            WEBSOCKET_URL,
          }}
        >
          <LazyMotion features={loadMotionFeatures} strict>
            {/* Skip transform and layout animations for users who ask the OS to reduce motion */}
            <MotionConfig reducedMotion="user">
              <TooltipProvider>{children}</TooltipProvider>
            </MotionConfig>
          </LazyMotion>
        </WebSocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
