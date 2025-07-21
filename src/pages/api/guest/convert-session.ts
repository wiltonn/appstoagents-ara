// API endpoint for converting guest sessions to user accounts
// Part of Task 2.4: Guest User Flow Enhancement

import type { APIRoute } from 'astro';
import { convertGuestSession } from '../../../utils/auth';
import { getAnonymousIdFromCookie, clearAnonymousIdCookie } from '../../../utils/auth';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return new Response(JSON.stringify({ 
        error: 'User ID is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get anonymous ID from cookies
    const cookieHeader = request.headers.get('cookie');
    const anonymousId = getAnonymousIdFromCookie(cookieHeader);

    if (!anonymousId) {
      return new Response(JSON.stringify({ 
        error: 'No guest session found to convert' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Convert the guest session to a user session
    const convertedSession = await convertGuestSession(anonymousId, userId);

    // Prepare response headers to clear the anonymous ID cookie
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Set-Cookie': clearAnonymousIdCookie()
    });

    console.log(`✅ Converted guest session ${anonymousId} to user ${userId}`);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Session converted successfully',
      session: {
        id: convertedSession.id,
        status: convertedSession.status,
        answersCount: convertedSession.answers?.length || 0,
        chatMessagesCount: convertedSession._count?.chatMessages || 0,
      }
    }), {
      headers
    });

  } catch (error) {
    console.error('Error converting guest session:', error);
    
    let errorMessage = 'Failed to convert session';
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.message === 'Guest session not found') {
        errorMessage = 'Guest session not found';
        statusCode = 404;
      } else {
        errorMessage = error.message;
      }
    }

    return new Response(JSON.stringify({
      error: 'Session conversion failed',
      message: errorMessage
    }), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};