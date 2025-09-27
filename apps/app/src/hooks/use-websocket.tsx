"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { env } from "~/lib/env";

export type WebSocketMessage = {
  type:
    | "job-refresh"
    | "queue-refresh"
    | "job-scheduler-refresh"
    | "log-refresh";
  data: {
    id?: string;
    queueName?: string;
    jobId?: string;
    schedulerKey?: string;
  };
};

export interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  autoReconnect?: boolean;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    reconnectDelay = 3000,
    maxReconnectAttempts = 5,
    autoReconnect = true,
  } = options;

  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);

  const websocketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const connectionAttemptsRef = useRef(0);

  const invalidateQueries = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case "job-refresh":
          queryClient.invalidateQueries({ queryKey: ["jobs/table"] });
          queryClient.invalidateQueries({ queryKey: ["jobs/stats"] });
          queryClient.invalidateQueries({
            queryKey: ["jobs/single", message.data.jobId],
          });
          break;
        case "queue-refresh":
          queryClient.invalidateQueries({ queryKey: ["queues/table"] });
          queryClient.invalidateQueries({ queryKey: ["queues/stats"] });
          break;
        case "job-scheduler-refresh":
          queryClient.invalidateQueries({ queryKey: ["queues/table"] });
          queryClient.invalidateQueries({ queryKey: ["queues/stats"] });
          break;
        case "log-refresh":
          console.log("🔍 Invalidating log queries", {
            id: message.data.jobId,
          });
          queryClient.invalidateQueries({
            queryKey: ["jobs/logs", message.data.jobId],
          });
          break;
      }
    },
    [queryClient],
  );

  const connect = useCallback(() => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(env.NEXT_PUBLIC_WEBSOCKET_URL);
      websocketRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
        connectionAttemptsRef.current = 0;
        setConnectionAttempts(0);
        onConnect?.();
        console.log("🔗 WebSocket connected");
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;

        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          if (message.data.id === "connected") return;

          invalidateQueries(message);
          onMessage?.(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        onDisconnect?.();
        console.log("🔌 WebSocket disconnected", {
          attempts: connectionAttemptsRef.current,
          maxReconnectAttempts,
          autoReconnect,
        });

        if (
          autoReconnect &&
          connectionAttemptsRef.current < maxReconnectAttempts
        ) {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connectionAttemptsRef.current += 1;
              setConnectionAttempts(connectionAttemptsRef.current);
              connect();
            }
          }, reconnectDelay);
        }
      };

      ws.onerror = (error) => {
        if (!mountedRef.current) return;
        console.error("WebSocket error:", error);
        onError?.(error);
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
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
  ]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }

    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((message: object) => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket is not connected. Cannot send message:", message);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    connectionAttempts,
    connect,
    disconnect,
    sendMessage,
  };
};

export const WebSocketProvider = ({
  children,
  options = {},
}: {
  children: React.ReactNode;
  options?: UseWebSocketOptions;
}) => {
  useWebSocket(options);
  return <>{children}</>;
};
