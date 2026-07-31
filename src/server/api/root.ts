import { createCallerFactory, createTRPCRouter } from "./trpc";
import { profileRouter } from "./routers/profile";
import { documentsRouter } from "./routers/documents";
import { applicationsRouter } from "./routers/applications";
import { contactsRouter } from "./routers/contacts";

export const appRouter = createTRPCRouter({
  profile: profileRouter,
  documents: documentsRouter,
  applications: applicationsRouter,
  contacts: contactsRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
