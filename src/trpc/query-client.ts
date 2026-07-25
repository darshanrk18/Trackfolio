import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
import superjson from "superjson";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Long enough that navigating between views feels instant, short enough
        // that data going stale in another tab is corrected quickly.
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          // Never retry an auth or validation failure; it will never succeed.
          const code = (error as { data?: { code?: string } })?.data?.code;
          if (
            code === "UNAUTHORIZED" ||
            code === "FORBIDDEN" ||
            code === "BAD_REQUEST" ||
            code === "NOT_FOUND" ||
            code === "TOO_MANY_REQUESTS"
          ) {
            return false;
          }
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8_000),
      },
      mutations: {
        retry: false,
      },
      dehydrate: {
        serializeData: superjson.serialize,
        // Include still-loading queries so streamed SSR can hand off in-flight
        // requests instead of restarting them on the client.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
      hydrate: {
        deserializeData: superjson.deserialize,
      },
    },
  });
}
