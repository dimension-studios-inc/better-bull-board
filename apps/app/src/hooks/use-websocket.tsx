"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"

type WebSocketMessage = {
  type:
    | "job-refresh"
    | "queue-refresh"
    | "job-scheduler-refresh"
    | "job-log-refresh"
    | "single-job-refresh"
    | "single-queue-refresh"
    | "single-job-scheduler-refresh"
  data: {
    id?: string
    queueName?: string
    jobId?: string
    schedulerKey?: string
  }
}

export interface UseWebSocketOptions {
  WEBSOCKET_URL: string
  onMessage?: (message: WebSocketMessage) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Event) => void
  reconnectDelay?: number
  maxReconnectAttempts?: number
  autoReconnect?: boolean
}

const useWebSocket = (options: UseWebSocketOptions) => {
  const {
    WEBSOCKET_URL,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    reconnectDelay = 3000,
    maxReconnectAttempts = 5,
    autoReconnect = true,
  } = options

  const queryClient = useQueryClient()
  const [isConnected, setIsConnected] = useState(false)
  const [connectionAttempts, setConnectionAttempts] = useState(0)
  // Bumped to open a new connection: each effect run owns exactly one socket
  const [connectionKey, setConnectionKey] = useState(0)
  const [isReconnectPending, setIsReconnectPending] = useState(false)
  const attemptsRef = useRef(0)

  const websocketRef = useRef<WebSocket | null>(null)

  const invalidateQueries = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case "job-refresh":
          void queryClient.invalidateQueries({ queryKey: ["jobs/table"] })
          void queryClient.invalidateQueries({ queryKey: ["jobs/stats"] })
          void queryClient.invalidateQueries({ queryKey: ["schedulers/table"] })
          break
        case "single-job-refresh":
          void queryClient.invalidateQueries({
            queryKey: ["jobs/single", message.data.jobId],
          })
          break
        case "queue-refresh":
          void queryClient.invalidateQueries({ queryKey: ["queues/table"] })
          void queryClient.invalidateQueries({ queryKey: ["queues/stats"] })
          break
        case "job-scheduler-refresh":
          void queryClient.invalidateQueries({ queryKey: ["queues/table"] })
          void queryClient.invalidateQueries({ queryKey: ["queues/stats"] })
          void queryClient.invalidateQueries({ queryKey: ["schedulers/table"] })
          break
        case "job-log-refresh":
          void queryClient.invalidateQueries({
            queryKey: ["jobs/logs", message.data.jobId],
          })
          break
        case "single-queue-refresh":
        case "single-job-scheduler-refresh":
          // No query is cached per queue or per scheduler yet
          break
      }
    },
    [queryClient],
  )

  useEffect(() => {
    let disposed = false
    // WEBSOCKET_URL is validated as a URL by env.ts, so the constructor doesn't throw
    const ws = new WebSocket(WEBSOCKET_URL)
    websocketRef.current = ws

    ws.addEventListener("open", () => {
      if (disposed) return
      setIsConnected(true)
      attemptsRef.current = 0
      setConnectionAttempts(0)
      onConnect?.()
      console.log("🔗 WebSocket connected")
    })

    ws.addEventListener("message", (event: MessageEvent<string>) => {
      if (disposed) return

      try {
        const message = JSON.parse(event.data) as WebSocketMessage
        if (message.data.id === "connected") return

        invalidateQueries(message)
        onMessage?.(message)
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error)
      }
    })

    ws.addEventListener("close", () => {
      if (disposed) return
      setIsConnected(false)
      onDisconnect?.()
      console.log("🔌 WebSocket disconnected", {
        attempts: attemptsRef.current,
        maxReconnectAttempts,
        autoReconnect,
      })

      if (autoReconnect && attemptsRef.current < maxReconnectAttempts) {
        setIsReconnectPending(true)
      }
    })

    ws.addEventListener("error", (error) => {
      if (disposed) return
      console.error("WebSocket error:", error)
      onError?.(error)
    })

    return () => {
      disposed = true
      ws.close()
      websocketRef.current = null
      setIsConnected(false)
    }
  }, [
    // Not read: bumping it re-runs the effect, which opens a new socket
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
    connectionKey,
    onConnect,
    onDisconnect,
    onError,
    onMessage,
    autoReconnect,
    maxReconnectAttempts,
    invalidateQueries,
    WEBSOCKET_URL,
  ])

  useEffect(() => {
    if (!isReconnectPending) return undefined

    const reconnectTimeout = setTimeout(() => {
      attemptsRef.current += 1
      setConnectionAttempts(attemptsRef.current)
      setIsReconnectPending(false)
      setConnectionKey((key) => key + 1)
    }, reconnectDelay)

    return () => clearTimeout(reconnectTimeout)
  }, [isReconnectPending, reconnectDelay])

  const sendMessage = useCallback((message: object) => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify(message))
    } else {
      console.warn("WebSocket is not connected. Cannot send message:", message)
    }
  }, [])

  return {
    isConnected,
    connectionAttempts,
    sendMessage,
  }
}

export const WebSocketProvider = ({
  children,
  options,
}: {
  children: React.ReactNode
  options: UseWebSocketOptions
}) => {
  useWebSocket(options)
  return <>{children}</>
}
