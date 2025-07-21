import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../server/routers/_app';
import superjson from 'superjson';

// Create a vanilla TRPC client for use outside of React components
export const trpcVanilla = createTRPCProxyClient<AppRouter>({
  transformer: superjson,
  links: [
    httpBatchLink({
      url: '/api/trpc',
      headers() {
        const headers: Record<string, string> = {};
        
        // Add auth header if available
        const token = typeof window !== 'undefined' ? localStorage.getItem('__clerk_token') : null;
        if (token) {
          headers.authorization = `Bearer ${token}`;
        }

        // Add anonymous ID for guest users
        const anonymousId = typeof window !== 'undefined' ? localStorage.getItem('ara_anonymous_id') : null;
        if (anonymousId && !token) {
          headers['x-anonymous-id'] = anonymousId;
        }

        return headers;
      },
    }),
  ],
});