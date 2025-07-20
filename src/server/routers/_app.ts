import { router } from '../trpc';
import { wizardRouter } from './wizard';
import { chatRouter } from './chat';
import { reportsRouter } from './reports';

export const appRouter = router({
  wizard: wizardRouter,
  chat: chatRouter,
  reports: reportsRouter,
});

export type AppRouter = typeof appRouter;