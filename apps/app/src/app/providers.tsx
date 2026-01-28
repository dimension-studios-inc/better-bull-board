"use client";

import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { WebSocketProvider } from "~/hooks/use-websocket";
import { AuthProvider } from "~/lib/auth/context";
import { createQueryClient } from "~/lib/query-client";

let clientQueryClientSingleton: QueryClient | undefined;
const getQueryClient = ({ onRedirect }: { onRedirect: (path: string) => void }) => {
  // biome-ignore lint/suspicious/noExplicitAny: globalThis is not typed
  if (typeof (globalThis as any).window === "undefined") {
    // Server: always make a new query client
    return createQueryClient();
  }
  // Browser: use singleton pattern to keep the same query client
  clientQueryClientSingleton ??= createQueryClient((path) => {
    onRedirect(path);
  });

  return clientQueryClientSingleton;
};

export const Providers = ({ children, WEBSOCKET_URL }: { children: React.ReactNode; WEBSOCKET_URL: string }) => {
  const router = useRouter();
  const queryClient = getQueryClient({
    onRedirect: (path) => {
      router.push(path);
    },
  });

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <WebSocketProvider
          options={{
            WEBSOCKET_URL,
          }}
        >
          {children}
        </WebSocketProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
};
