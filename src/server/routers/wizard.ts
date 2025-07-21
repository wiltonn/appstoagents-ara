import { z } from 'zod';
import { router, publicProcedure, protectedProcedure, guestOrAuthProcedure } from '../trpc';
import { db, getOrCreateAnonymousSession, getOrCreateUserSession } from '../../utils/db';
import { scoringEngine } from '../../lib/scoring';
import { getScoringConfig } from '../../config/scoring';

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

        // Calculate real-time scoring preview
        let scoringPreview = null;
        let currentScore = null;
        
        try {
          // Update scoring engine with appropriate config based on answers
          const config = getScoringConfig(answersMap);
          scoringEngine.updateConfig(config);
          
          // Generate scoring preview
          scoringPreview = scoringEngine.generateScoringPreview(answersMap, currentStep);
          currentScore = scoringEngine.calculateTotalScore(answersMap);
          
          // Update session with partial score
          await db.auditSession.update({
            where: { id: session.id },
            data: { 
              score: currentScore.totalScore,
              updatedAt: new Date(),
            },
          });
        } catch (error) {
          console.error('Error calculating scoring preview:', error);
        }

        return {
          sessionId: session.id,
          currentStep,
          totalSteps,
          completedSteps,
          answers: answersMap,
          partialScore: currentScore?.totalScore || (session.score ? Number(session.score) : null),
          currentScore,
          scoringPreview,
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

        // Calculate final comprehensive score
        const answersMap = updatedSession.answers.reduce((acc, answer) => {
          acc[answer.questionKey] = answer.value;
          return acc;
        }, {} as Record<string, any>);

        // Get appropriate scoring configuration and calculate final score
        const config = getScoringConfig(answersMap);
        scoringEngine.updateConfig(config);
        const finalScore = scoringEngine.calculateTotalScore(answersMap);

        // Update session with final score
        await db.auditSession.update({
          where: { id: updatedSession.id },
          data: { 
            score: finalScore.totalScore,
            updatedAt: new Date(),
          },
        });

        return {
          success: true,
          sessionId: updatedSession.id,
          score: finalScore,
          pdfJobId: null, // Will be implemented in Phase 2.3
          message: 'Audit submitted successfully with comprehensive scoring',
        };
      } catch (error) {
        console.error('Error submitting audit:', error);
        throw new Error('Failed to submit audit');
      }
    }),

  calculateScore: guestOrAuthProcedure
    .input(z.object({
      answers: z.record(z.any()),
      currentStep: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      try {
        // Get appropriate scoring configuration based on answers
        const config = getScoringConfig(input.answers);
        scoringEngine.updateConfig(config);
        
        // Calculate current score and preview
        const currentScore = scoringEngine.calculateTotalScore(input.answers);
        const scoringPreview = scoringEngine.generateScoringPreview(
          input.answers, 
          input.currentStep
        );

        return {
          success: true,
          currentScore,
          scoringPreview,
          configVersion: config.version,
        };
      } catch (error) {
        console.error('Error calculating score:', error);
        throw new Error('Failed to calculate score');
      }
    }),

  updateScoringConfig: protectedProcedure
    .input(z.object({
      config: z.any(), // ScoringConfig type - would need proper zod schema in production
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Update the scoring engine configuration (hot-reload)
        scoringEngine.updateConfig(input.config);
        
        return {
          success: true,
          message: 'Scoring configuration updated successfully',
          version: input.config.version,
        };
      } catch (error) {
        console.error('Error updating scoring config:', error);
        throw new Error('Failed to update scoring configuration');
      }
    }),
});