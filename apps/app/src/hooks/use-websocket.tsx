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
    let mounted = true
    let attempts = 0
    let reconnectTimeout: ReturnType<typeof setTimeout> | undefined

    const connect = () => {
      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        return
      }

      try {
        const ws = new WebSocket(WEBSOCKET_URL)
        websocketRef.current = ws

        ws.addEventListener("open", () => {
          if (!mounted) return
          setIsConnected(true)
          attempts = 0
          setConnectionAttempts(0)
          onConnect?.()
          console.log("🔗 WebSocket connected")
        })

        ws.addEventListener("message", (event: MessageEvent<string>) => {
          if (!mounted) return

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
          if (!mounted) return
          setIsConnected(false)
          onDisconnect?.()
          console.log("🔌 WebSocket disconnected", {
            attempts,
            maxReconnectAttempts,
            autoReconnect,
          })

          if (autoReconnect && attempts < maxReconnectAttempts) {
            reconnectTimeout = setTimeout(() => {
              if (mounted) {
                attempts += 1
                setConnectionAttempts(attempts)
                connect()
              }
            }, reconnectDelay)
          }
        })

        ws.addEventListener("error", (error) => {
          if (!mounted) return
          console.error("WebSocket error:", error)
          onError?.(error)
        })
      } catch (error) {
        console.error("Failed to create WebSocket connection:", error)
      }
    }

    connect()

    return () => {
      mounted = false
      clearTimeout(reconnectTimeout)
      websocketRef.current?.close()
      websocketRef.current = null
      setIsConnected(false)
    }
  }, [
    onConnect,
    onDisconnect,
    onError,
    onMessage,
    autoReconnect,
    maxReconnectAttempts,
    reconnectDelay,
    invalidateQueries,
    WEBSOCKET_URL,
  ])

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
