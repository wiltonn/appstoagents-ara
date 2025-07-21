// API route for OpenAI streaming responses
// Handles Server-Sent Events for real-time chat streaming

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

    // Build system prompt with context awareness
    const systemPrompt = buildSystemPrompt(context);
    const enhancedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    // Create OpenAI stream
    const stream = await openai.chat.completions.create({
      model,
      messages: enhancedMessages,
      max_tokens,
      temperature,
      stream: true,
    });

    // Create a ReadableStream for streaming response
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            
            if (content) {
              // Send chunk as Server-Sent Event
              const sseData = `data: ${JSON.stringify({
                id: chunk.id,
                object: chunk.object,
                created: chunk.created,
                model: chunk.model,
                choices: chunk.choices,
              })}\n\n`;
              
              controller.enqueue(new TextEncoder().encode(sseData));
            }

            // Check if stream is complete
            if (chunk.choices[0]?.finish_reason) {
              controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
              break;
            }
          }
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          const errorData = `data: ${JSON.stringify({
            error: 'Internal server error',
            message: 'Failed to process streaming request'
          })}\n\n`;
          controller.enqueue(new TextEncoder().encode(errorData));
          controller.close();
        }
      }
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      }
    });

  } catch (error) {
    console.error('API error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: 'Failed to process request'
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

  if (context?.wizardContext) {
    prompt += ` Based on their previous answers, they appear to be working on: ${JSON.stringify(context.wizardContext).slice(0, 200)}...`;
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