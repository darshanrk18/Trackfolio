import { createCallerFactory, createTRPCRouter } from "./trpc";
import { profileRouter } from "./routers/profile";
import { documentsRouter } from "./routers/documents";

export const appRouter = createTRPCRouter({
  profile: profileRouter,
  documents: documentsRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
