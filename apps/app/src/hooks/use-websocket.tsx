"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { env } from "~/lib/env";

export interface WebSocketMessage {
  type: "job-refresh" | "queue-refresh" | "job-scheduler-refresh" | "log-refresh";
  data: {
    id?: string;
    queueName?: string;
    jobId?: string;
    schedulerKey?: string;
  };
}

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

  const invalidateQueries = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case "job-refresh":
          // Invalidate job-related queries
          queryClient.invalidateQueries({ queryKey: ["jobs/table"] });
          queryClient.invalidateQueries({ queryKey: ["jobs/stats"] });
          break;
        
        case "queue-refresh":
          // Invalidate queue-related queries  
          queryClient.invalidateQueries({ queryKey: ["queues/table"] });
          queryClient.invalidateQueries({ queryKey: ["queues/stats"] });
          break;
          
        case "job-scheduler-refresh":
          // Invalidate scheduler-related queries (affects queues since schedulers are part of queue data)
          queryClient.invalidateQueries({ queryKey: ["queues/table"] });
          queryClient.invalidateQueries({ queryKey: ["queues/stats"] });
          break;
          
        case "log-refresh":
          // Invalidate job-related queries since logs are part of job data
          queryClient.invalidateQueries({ queryKey: ["jobs/table"] });
          queryClient.invalidateQueries({ queryKey: ["jobs/stats"] });
          break;
      }
    },
    [queryClient]
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
        setConnectionAttempts(0);
        onConnect?.();
        console.log("🔗 WebSocket connected");
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          // Skip the initial connection confirmation
          if (message.data.id === "connected") {
            return;
          }
          
          console.log("📨 WebSocket message received:", message);
          
          // Auto-invalidate queries based on message type
          invalidateQueries(message);
          
          // Call custom message handler
          onMessage?.(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        
        setIsConnected(false);
        onDisconnect?.();
        console.log("🔌 WebSocket disconnected");

        // Auto-reconnect if enabled and we haven't exceeded max attempts
        if (autoReconnect && connectionAttempts < maxReconnectAttempts) {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              setConnectionAttempts(prev => prev + 1);
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
    connectionAttempts,
    maxReconnectAttempts,
    reconnectDelay,
    invalidateQueries
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

  // Auto-connect on mount
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

// Provider component for easy WebSocket integration
export const WebSocketProvider = ({ 
  children, 
  options = {} 
}: { 
  children: React.ReactNode;
  options?: UseWebSocketOptions;
}) => {
  useWebSocket(options);
  return <>{children}</>;
};