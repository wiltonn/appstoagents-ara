import type { APIRoute } from 'astro';
// Auth is provided by middleware in context.locals
import { convertGuestSession, clearAnonymousIdCookie } from '../../../utils/auth';

export const POST: APIRoute = async (context) => {
  try {
    const userId = context.locals.userId;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const body = await context.request.json();
    const { anonymousId } = body;

    if (!anonymousId) {
      return new Response(
        JSON.stringify({ error: 'Anonymous ID required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Convert guest session to user session
    const convertedSession = await convertGuestSession(anonymousId, userId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sessionId: convertedSession.id,
        message: 'Session converted successfully'
      }),
      { 
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Set-Cookie': clearAnonymousIdCookie()
        }
      }
    );
  } catch (error) {
    console.error('Error converting session:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to convert session',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};