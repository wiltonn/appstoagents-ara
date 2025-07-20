import { router } from './trpc';
import { wizardRouter } from './routers/wizard';

export const appRouter = router({
  wizard: wizardRouter,
});

export type AppRouter = typeof appRouter;