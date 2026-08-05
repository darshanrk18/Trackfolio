import { createCallerFactory, createTRPCRouter } from "./trpc";
import { profileRouter } from "./routers/profile";
import { documentsRouter } from "./routers/documents";
import { applicationsRouter } from "./routers/applications";
import { contactsRouter } from "./routers/contacts";
import { analysisRouter } from "./routers/analysis";
import { insightsRouter } from "./routers/insights";
import { latexRouter } from "./routers/latex";
import { aiRouter } from "./routers/ai";
import { dataRouter } from "./routers/data";

export const appRouter = createTRPCRouter({
  profile: profileRouter,
  documents: documentsRouter,
  applications: applicationsRouter,
  contacts: contactsRouter,
  analysis: analysisRouter,
  insights: insightsRouter,
  latex: latexRouter,
  ai: aiRouter,
  data: dataRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
