import "server-only";

import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { headers } from "next/headers";
import { cache } from "react";
import { createCaller } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";
import { createQueryClient } from "./query-client";

/**
 * Server-side tRPC context, cached per request so multiple server components
 * resolving data share one session lookup.
 */
const createContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");
  return createTRPCContext({ headers: heads });
});

export const getQueryClient = cache(createQueryClient);

/** Direct caller for server components — no HTTP round trip. */
export const api = createTRPCOptionsProxy({
  ctx: createContext,
  router: (await import("@/server/api/root")).appRouter,
  queryClient: getQueryClient,
});

/** Imperative caller, for server actions and route handlers. */
export const serverApi = async () => createCaller(await createContext());
