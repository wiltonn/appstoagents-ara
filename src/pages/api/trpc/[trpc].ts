import type { APIRoute } from 'astro';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '../../../server/router';
import { createContext } from '../../../server/trpc';

// This is a dynamic API route that should be server-rendered
export const prerender = false;

export const ALL: APIRoute = (context) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req: context.request,
    router: appRouter,
    createContext: () => createContext(context),
    onError: ({ error, path }: { error: any; path: string | undefined }) => {
      console.error(`❌ tRPC Error on ${path}:`, error);
    },
  });