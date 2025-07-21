// API route for OpenAI non-streaming chat completions
// Handles standard (non-streaming) chat responses

import type { APIRoute } from 'astro';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.OPENAI_API_KEY,
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { messages, model = 'gpt-4o-mini', max_tokens = 1000, temperature = 0.7, context } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate messages format
    for (const message of messages) {
      if (!message.role || !message.content) {
        return new Response(JSON.stringify({ error: 'Each message must have role and content' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (!['system', 'user', 'assistant'].includes(message.role)) {
        return new Response(JSON.stringify({ error: 'Invalid message role' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Build system prompt with context awareness
    const systemPrompt = buildSystemPrompt(context);
    const enhancedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    // Create OpenAI completion
    const completion = await openai.chat.completions.create({
      model,
      messages: enhancedMessages,
      max_tokens,
      temperature,
    });

    // Return completion response
    return new Response(JSON.stringify({
      id: completion.id,
      object: completion.object,
      created: completion.created,
      model: completion.model,
      choices: completion.choices,
      usage: completion.usage,
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Completion error:', error);
    
    // Handle different types of errors
    if (error instanceof OpenAI.APIError) {
      return new Response(JSON.stringify({
        error: 'OpenAI API error',
        message: error.message,
        type: error.type,
      }), {
        status: error.status || 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (error instanceof Error) {
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      error: 'Unknown error',
      message: 'An unexpected error occurred',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Build context-aware system prompt
function buildSystemPrompt(context?: any): string {
  let prompt = `You are an AI assistant helping users complete an Agent Readiness Audit. You provide helpful, accurate, and contextual guidance.`;

  if (context?.currentStep) {
    prompt += ` The user is currently on step ${context.currentStep}`;
    if (context.stepTitle) {
      prompt += ` (${context.stepTitle})`;
    }
    if (context.totalSteps) {
      prompt += ` of ${context.totalSteps}`;
    }
    prompt += '.';
  }

  if (context?.wizardContext || context?.currentAnswers) {
    const answers = context?.wizardContext || context?.currentAnswers;
    prompt += ` Based on their previous answers, they appear to be working on: ${JSON.stringify(answers).slice(0, 200)}...`;
  }

  prompt += ` 

Guidelines:
- Keep responses concise but helpful (1-3 sentences typically)
- Focus on the current step and question being answered
- Provide specific, actionable guidance
- Don't make assumptions about their business if not provided
- If they ask about scoring, explain it helps assess readiness for AI agents`;

  return prompt;
}