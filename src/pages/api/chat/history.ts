// API route for chat history retrieval
// Handles loading chat message history for a session

import type { APIRoute } from 'astro';
import { messageService } from '../../../lib/messageService';

export const GET: APIRoute = async ({ request, url }) => {
  try {
    const sessionId = url.searchParams.get('sessionId');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Session ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const messages = await messageService.getChatHistory(sessionId, limit, offset);

    return new Response(JSON.stringify({
      messages,
      count: messages.length,
      hasMore: messages.length === limit,
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error retrieving chat history:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: 'Failed to retrieve chat history'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { query, sessionId, limit = 5, threshold = 0.8 } = body;

    if (!query || !sessionId) {
      return new Response(JSON.stringify({ error: 'Query and session ID are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const similarMessages = await messageService.findSimilarMessages(
      query,
      sessionId,
      limit,
      threshold
    );

    return new Response(JSON.stringify({
      similarMessages,
      count: similarMessages.length,
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error searching similar messages:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: 'Failed to search messages'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};