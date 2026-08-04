import { createCallerFactory, createTRPCRouter } from "./trpc";
import { profileRouter } from "./routers/profile";
import { documentsRouter } from "./routers/documents";
import { applicationsRouter } from "./routers/applications";
import { contactsRouter } from "./routers/contacts";
import { latexRouter } from "./routers/latex";
import { aiRouter } from "./routers/ai";

export const appRouter = createTRPCRouter({
  profile: profileRouter,
  documents: documentsRouter,
  applications: applicationsRouter,
  contacts: contactsRouter,
  latex: latexRouter,
  ai: aiRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
