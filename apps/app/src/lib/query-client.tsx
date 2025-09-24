import { logger } from "@rharkor/logger";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const createQueryClient = (_redirect?: (path: string) => void) =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 30 * 1000,
        retry: 1,
      },
    },
    queryCache: new QueryCache({
      onError: (error) => {
        logger.error("Query error", error);
        toast.error("Unknown error");
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        logger.error("Mutation error", error);
        toast.error("Unknown error");
      },
    }),
  });
