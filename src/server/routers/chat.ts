import { z } from 'zod';
import { router, publicProcedure } from '../trpc';

export const chatRouter = router({
  sendMessage: publicProcedure
    .input(z.object({
      message: z.string(),
      sessionId: z.string(),
      stepContext: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // TODO: Stream response from OpenAI in Phase 2.2
      console.log('Chat message received:', input);
      
      return {
        message: 'This is a placeholder response. Chat integration coming in Phase 2.',
        suggestions: [],
      };
    }),

  getHistory: publicProcedure
    .input(z.object({
      sessionId: z.string(),
      limit: z.number().default(50),
    }))
    .query(async ({ input, ctx }) => {
      // TODO: Fetch chat history with pagination in Phase 2.2
      console.log('Getting chat history for session:', input.sessionId);
      
      return {
        messages: [],
        hasMore: false,
      };
    }),
});