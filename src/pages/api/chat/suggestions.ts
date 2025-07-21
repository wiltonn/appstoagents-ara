// API route for contextual suggestion generation
// Provides smart response suggestions based on conversation context

import type { APIRoute } from 'astro';
import { messageService } from '../../../lib/messageService';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { sessionId, context, limit = 4 } = body;

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Session ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const suggestions = await messageService.getContextualSuggestions(
      sessionId,
      context,
      limit
    );

    return new Response(JSON.stringify({
      suggestions,
      count: suggestions.length,
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating suggestions:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: 'Failed to generate suggestions'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const GET: APIRoute = async ({ url }) => {
  try {
    const sessionId = url.searchParams.get('sessionId');
    const currentStep = url.searchParams.get('currentStep');
    const stepTitle = url.searchParams.get('stepTitle');
    const limit = parseInt(url.searchParams.get('limit') || '4');

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Session ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const context = {
      currentStep: currentStep ? parseInt(currentStep) : undefined,
      stepTitle,
    };

    const suggestions = await messageService.getContextualSuggestions(
      sessionId,
      context,
      limit
    );

    return new Response(JSON.stringify({
      suggestions,
      count: suggestions.length,
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating suggestions:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: 'Failed to generate suggestions'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};