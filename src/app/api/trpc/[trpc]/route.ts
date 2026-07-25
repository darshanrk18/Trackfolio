import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";
import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";
import { logger } from "@/server/lib/logger";

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
    onError({ error, path, type }) {
      // Client-caused errors are expected; only page on real faults.
      if (error.code === "INTERNAL_SERVER_ERROR") {
        logger.error({ err: error, path, type }, "trpc internal error");
      } else {
        logger.debug({ code: error.code, path, type }, "trpc handled error");
      }
    },
  });

export { handler as GET, handler as POST };
