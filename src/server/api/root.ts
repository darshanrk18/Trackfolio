import { createCallerFactory, createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
