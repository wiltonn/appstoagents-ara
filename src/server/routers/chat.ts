import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import OpenAI from 'openai';
import type { ChatMessage, ChatContext } from '../../types/chat';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Validation schemas
const chatMessageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  type: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.date(),
  metadata: z.object({
    currentStep: z.number().optional(),
    totalSteps: z.number().optional(),
    stepTitle: z.string().optional(),
    wizardContext: z.record(z.any()).optional(),
    model: z.string().optional(),
    tokens: z.object({
      prompt: z.number(),
      completion: z.number(),
      total: z.number(),
    }).optional(),
    embedding: z.array(z.number()).optional(),
    processingTime: z.number().optional(),
    streamingComplete: z.boolean().optional(),
  }).optional(),
});

const chatContextSchema = z.object({
  currentStep: z.number(),
  totalSteps: z.number(),
  stepTitle: z.string(),
  stepDescription: z.string().optional(),
  currentAnswers: z.record(z.any()),
  completedSteps: z.array(z.number()),
  pillarScores: z.record(z.number()).optional(),
  overallProgress: z.number(),
});

export const chatRouter = router({
  // Send message and get streaming response
  sendMessage: publicProcedure
    .input(z.object({
      message: z.string().min(1).max(1000),
      sessionId: z.string(),
      context: chatContextSchema.optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const { message, sessionId, context } = input;

        // Build system prompt
        const systemPrompt = buildSystemPrompt();
        const contextPrompt = context ? buildContextPrompt(context) : 'The user has not started the audit yet.';

        // Prepare messages for OpenAI
        const messages = [
          { role: 'system' as const, content: systemPrompt },
          { role: 'system' as const, content: contextPrompt },
          { role: 'user' as const, content: message },
        ];

        // Get OpenAI response
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages,
          max_tokens: 1000,
          temperature: 0.7,
        });

        const responseContent = completion.choices[0]?.message?.content || 'I apologize, but I encountered an error processing your message.';
        const usage = completion.usage;

        // Create response message
        const responseMessage: ChatMessage = {
          id: `assistant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          sessionId,
          type: 'assistant',
          content: responseContent,
          timestamp: new Date(),
          metadata: {
            currentStep: context?.currentStep,
            totalSteps: context?.totalSteps,
            stepTitle: context?.stepTitle,
            wizardContext: context?.currentAnswers,
            model: 'gpt-4o-mini',
            tokens: {
              prompt: usage?.prompt_tokens || 0,
              completion: usage?.completion_tokens || 0,
              total: usage?.total_tokens || 0,
            },
            processingTime: Date.now() - new Date().getTime(),
            streamingComplete: false,
          },
        };

        // TODO: Store message in database with vector embedding
        // await ctx.db.chatMessage.create({ data: responseMessage });

        // Generate suggested responses
        const suggestions = generateSuggestedResponses(context);

        return {
          message: responseMessage,
          suggestions,
        };
      } catch (error) {
        console.error('Chat error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to process chat message',
          cause: error,
        });
      }
    }),

  // Streaming endpoint for real-time responses
  streamMessage: publicProcedure
    .input(z.object({
      messages: z.array(z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string(),
      })),
      model: z.string().default('gpt-4o-mini'),
      maxTokens: z.number().default(1000),
      temperature: z.number().default(0.7),
    }))
    .mutation(async ({ input }) => {
      try {
        const stream = await openai.chat.completions.create({
          model: input.model,
          messages: input.messages,
          max_tokens: input.maxTokens,
          temperature: input.temperature,
          stream: true,
        });

        // Note: This returns the stream object for processing in the API route
        // The actual streaming will be handled by the WebSocket or Server-Sent Events
        return { streamId: `stream_${Date.now()}` };
      } catch (error) {
        console.error('Streaming error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create stream',
          cause: error,
        });
      }
    }),

  // Get chat history with pagination
  getHistory: publicProcedure
    .input(z.object({
      sessionId: z.string(),
      limit: z.number().min(1).max(100).default(50),
      cursor: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      try {
        const { sessionId, limit, cursor } = input;

        // TODO: Implement database query with pagination
        // const messages = await ctx.db.chatMessage.findMany({
        //   where: { sessionId },
        //   orderBy: { timestamp: 'desc' },
        //   take: limit + 1,
        //   cursor: cursor ? { id: cursor } : undefined,
        // });

        // Placeholder implementation
        const messages: ChatMessage[] = [];
        const hasMore = false;
        const nextCursor = null;

        return {
          messages: messages.slice(0, limit),
          hasMore,
          nextCursor,
        };
      } catch (error) {
        console.error('Get history error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch chat history',
          cause: error,
        });
      }
    }),

  // Get suggested responses based on context
  getSuggestedResponses: publicProcedure
    .input(z.object({
      context: chatContextSchema.optional(),
    }))
    .query(async ({ input }) => {
      const suggestions = generateSuggestedResponses(input.context);
      return { suggestions };
    }),

  // Store message with vector embedding
  storeMessage: publicProcedure
    .input(chatMessageSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // TODO: Generate vector embedding and store in database
        // const embedding = await generateEmbedding(input.content);
        // await ctx.db.chatMessage.create({
        //   data: {
        //     ...input,
        //     embedding,
        //   },
        // });

        console.log('Storing message:', input.id);
        return { success: true };
      } catch (error) {
        console.error('Store message error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to store message',
          cause: error,
        });
      }
    }),
});

// Helper functions
function buildSystemPrompt(): string {
  return `You are an AI assistant helping users complete an Agent Readiness Audit. Your role is to:

1. Answer questions about the audit process clearly and concisely
2. Help users understand what each question is assessing
3. Provide guidance on how to answer questions accurately
4. Explain scoring methodology when asked
5. Offer encouragement and support throughout the process

Guidelines:
- Be helpful, supportive, and professional
- Keep responses concise but informative
- Focus on the audit context and user's current progress
- Don't make assumptions about the user's technical background
- If you don't know something specific about their organization, ask clarifying questions
- Prioritize accuracy over speed in your responses

Current date: ${new Date().toISOString().split('T')[0]}`;
}

function buildContextPrompt(context: ChatContext): string {
  const { currentStep, totalSteps, stepTitle, overallProgress, currentAnswers } = context;
  
  return `Current wizard context:
- Step: ${currentStep} of ${totalSteps} (${stepTitle})
- Overall progress: ${Math.round(overallProgress)}%
- Questions answered: ${Object.keys(currentAnswers).length}

User is currently working on: ${stepTitle}

Recent answers context: ${buildAnswersContext(currentAnswers)}`;
}

function buildAnswersContext(answers: Record<string, any>): string {
  const recentAnswers = Object.entries(answers)
    .slice(-5) // Last 5 answers for context
    .map(([key, value]) => `${key}: ${formatAnswerForContext(value)}`)
    .join(', ');
  
  return recentAnswers || 'No answers provided yet';
}

function formatAnswerForContext(value: any): string {
  if (typeof value === 'string') return value.length > 50 ? value.substring(0, 50) + '...' : value;
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return `[${value.length} items]`;
  return '[Complex answer]';
}

function generateSuggestedResponses(context?: ChatContext) {
  if (!context) {
    return [
      { id: 'default1', text: 'How does this audit work?', category: 'question', relevanceScore: 0.9 },
      { id: 'default2', text: 'What will I learn from this?', category: 'question', relevanceScore: 0.8 },
      { id: 'default3', text: 'How long does it take?', category: 'question', relevanceScore: 0.7 },
      { id: 'default4', text: 'Get started with the audit', category: 'navigation', relevanceScore: 0.6 }
    ];
  }

  const suggestions = [];
  const step = context.currentStep;
  const progress = context.overallProgress;

  // Context-aware suggestions based on current wizard step
  if (step === 1) {
    suggestions.push(
      { id: '1', text: 'What information do I need to prepare?', category: 'question', relevanceScore: 0.9, wizardStepRelevant: [1] },
      { id: '2', text: 'How long will this audit take?', category: 'question', relevanceScore: 0.8, wizardStepRelevant: [1] },
      { id: '3', text: 'Can I save my progress and come back later?', category: 'question', relevanceScore: 0.7, wizardStepRelevant: [1] }
    );
  } else if (progress < 50) {
    suggestions.push(
      { id: '4', text: 'What does this question assess?', category: 'clarification', relevanceScore: 0.9 },
      { id: '5', text: 'How should I answer this accurately?', category: 'help', relevanceScore: 0.8 },
      { id: '6', text: 'Can I skip questions I\'m unsure about?', category: 'question', relevanceScore: 0.6 }
    );
  } else {
    suggestions.push(
      { id: '7', text: 'How is my score calculated?', category: 'question', relevanceScore: 0.9 },
      { id: '8', text: 'What do my current results indicate?', category: 'question', relevanceScore: 0.8 },
      { id: '9', text: 'When will I receive my report?', category: 'question', relevanceScore: 0.7 }
    );
  }

  return suggestions.slice(0, 4); // Limit to 4 suggestions
}