import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { z } from 'zod';
import type { APIContext } from 'astro';
import type { GetAuthReturn } from '@clerk/astro/server';
import { generateAnonymousId } from '../utils/db';

// Extend Astro locals to include auth
declare global {
  namespace App {
    interface Locals {
      userId?: string;
    }
  }
}

export interface Context {
  user?: {
    id: string;
    type: 'authenticated' | 'guest';
  };
  req: APIContext['request'];
}

// Create context for tRPC
export async function createContext(context: APIContext): Promise<Context> {
  // Get auth from middleware-provided locals
  const userId = context.locals.userId;

  let contextUser: Context['user'];

  if (userId) {
    // Authenticated user
    contextUser = {
      id: userId,
      type: 'authenticated',
    };
  } else {
    // Guest user - get anonymous ID from session/cookie or create new one
    const anonymousId = getAnonymousIdFromRequest(context.request) || generateAnonymousId();
    contextUser = {
      id: anonymousId,
      type: 'guest',
    };
  }

  return {
    user: contextUser,
    req: context.request,
  };
}

// Helper function to extract anonymous ID from request
function getAnonymousIdFromRequest(request: Request): string | null {
  // Try to get from cookie first
  const cookies = request.headers.get('cookie');
  if (cookies) {
    const match = cookies.match(/anonymous_id=([^;]+)/);
    if (match) {
      return match[1];
    }
  }
  
  // Try to get from headers (for programmatic access)
  const headerAnonymousId = request.headers.get('x-anonymous-id');
  if (headerAnonymousId) {
    return headerAnonymousId;
  }

  return null;
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.code === 'BAD_REQUEST' && error.cause instanceof z.ZodError
            ? error.cause.flatten()
            : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(
  t.middleware(({ ctx, next }) => {
    if (!ctx.user || ctx.user.type !== 'authenticated') {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  })
);

export const guestOrAuthProcedure = t.procedure.use(
  t.middleware(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  })
);