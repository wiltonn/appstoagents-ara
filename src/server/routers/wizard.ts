import { z } from 'zod';
import { router, publicProcedure, protectedProcedure, guestOrAuthProcedure } from '../trpc';
import { db, getOrCreateAnonymousSession, getOrCreateUserSession } from '../../utils/db';

export const wizardRouter = router({
  saveAnswer: guestOrAuthProcedure
    .input(z.object({
      questionKey: z.string(),
      value: z.any(),
      stepId: z.string().default('step_1'),
      sessionId: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        let session;
        
        // Get or create session based on user type
        if (ctx.user.type === 'authenticated') {
          session = await getOrCreateUserSession(ctx.user.id);
        } else {
          session = await getOrCreateAnonymousSession(ctx.user.id);
        }

        // Upsert the answer
        const answer = await db.auditAnswer.upsert({
          where: {
            unique_session_question: {
              auditSessionId: session.id,
              questionKey: input.questionKey,
            },
          },
          update: {
            value: input.value,
            stepId: input.stepId,
            updatedAt: new Date(),
          },
          create: {
            auditSessionId: session.id,
            questionKey: input.questionKey,
            stepId: input.stepId,
            value: input.value,
          },
        });

        // Update session timestamp
        await db.auditSession.update({
          where: { id: session.id },
          data: { updatedAt: new Date() },
        });

        return {
          success: true,
          message: 'Answer saved successfully',
          sessionId: session.id,
          answerId: answer.id,
        };
      } catch (error) {
        console.error('Error saving answer:', error);
        throw new Error('Failed to save answer');
      }
    }),

  getProgress: guestOrAuthProcedure
    .input(z.object({
      sessionId: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      try {
        let session;
        
        // Get session based on user type
        if (ctx.user.type === 'authenticated') {
          session = await getOrCreateUserSession(ctx.user.id);
        } else {
          session = await getOrCreateAnonymousSession(ctx.user.id);
        }

        // Get all answers for the session
        const answers = await db.auditAnswer.findMany({
          where: { auditSessionId: session.id },
          orderBy: { updatedAt: 'desc' },
        });

        // Calculate progress
        const answersByStep = answers.reduce((acc, answer) => {
          acc[answer.stepId] = acc[answer.stepId] || [];
          acc[answer.stepId].push(answer);
          return acc;
        }, {} as Record<string, any[]>);

        const completedSteps = Object.keys(answersByStep);
        const totalSteps = 8; // From wizard design
        const currentStep = Math.min(completedSteps.length + 1, totalSteps);

        // Convert answers to key-value format
        const answersMap = answers.reduce((acc, answer) => {
          acc[answer.questionKey] = answer.value;
          return acc;
        }, {} as Record<string, any>);

        return {
          sessionId: session.id,
          currentStep,
          totalSteps,
          completedSteps,
          answers: answersMap,
          partialScore: session.score ? Number(session.score) : null,
          status: session.status,
        };
      } catch (error) {
        console.error('Error getting progress:', error);
        throw new Error('Failed to get progress');
      }
    }),

  finalSubmit: protectedProcedure
    .input(z.object({
      sessionId: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Get user session
        const session = await getOrCreateUserSession(ctx.user.id);
        
        // Update session status
        const updatedSession = await db.auditSession.update({
          where: { id: session.id },
          data: {
            status: 'SUBMITTED',
            completedAt: new Date(),
          },
          include: {
            answers: true,
          },
        });

        // TODO: Implement full scoring in Phase 1.5
        // For now, return placeholder data
        return {
          success: true,
          sessionId: updatedSession.id,
          score: {
            total: 0,
            pillars: [],
          },
          pdfJobId: null,
          message: 'Audit submitted successfully. Scoring will be implemented in Phase 1.5',
        };
      } catch (error) {
        console.error('Error submitting audit:', error);
        throw new Error('Failed to submit audit');
      }
    }),
});