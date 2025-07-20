import { clerkMiddleware, createRouteMatcher } from '@clerk/astro/server';

// Define routes that require authentication
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/api/trpc/wizard.finalSubmit',
  '/admin(.*)',
]);

// Define routes that should redirect authenticated users
const isAuthRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
]);

export const onRequest = clerkMiddleware((auth, context) => {
  const { userId } = auth();
  const { url } = context.request;

  // Add auth info to context for tRPC and other components
  context.locals.userId = userId || undefined;

  // If user is not authenticated and trying to access protected route
  if (!userId && isProtectedRoute(context.request)) {
    return auth().redirectToSignIn();
  }

  // If user is authenticated and on auth page, redirect to dashboard
  if (userId && isAuthRoute(context.request)) {
    return Response.redirect(new URL('/dashboard', url));
  }

  // Continue with the request
  return;
});