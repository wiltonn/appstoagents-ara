// Optimized Wizard Router - Task 3.1: Performance Optimization
// Enhanced with caching, performance monitoring, and optimized queries

import { z } from 'zod';
import { router, publicProcedure, protectedProcedure, guestOrAuthProcedure } from '../trpc';
import { dbOptimized } from '../../lib/dbOptimized';
import { cache, CACHE_KEYS, CACHE_TTL } from '../../lib/cache';
import { getOrCreateAnonymousSession, getOrCreateUserSession } from '../../utils/db';
import { scoringEngine } from '../../lib/scoring';
import { getScoringConfig } from '../../config/scoring';

// Performance monitoring middleware
const performanceMiddleware = (procedureName: string) => {
  return async (opts: any, next: any) => {
    const start = Date.now();
    
    try {
      const result = await next(opts);
      const duration = Date.now() - start;
      
      // Log slow operations
      if (duration > 500) {
        console.warn(`🐌 Slow tRPC operation: ${procedureName} (${duration}ms)`);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      console.error(`❌ tRPC error in ${procedureName} (${duration}ms):`, error);
      throw error;
    }
  };
};

export const wizardOptimizedRouter = router({
  // Save answer with optimized caching and batch operations
  saveAnswer: guestOrAuthProcedure
    .input(z.object({
      questionKey: z.string(),
      value: z.any(),
      stepId: z.string().default('step_1'),
      sessionId: z.string().optional(),
    }))
    .use(performanceMiddleware('saveAnswer'))
    .mutation(async ({ input, ctx }) => {
      const start = Date.now();
      
      try {
        let session;
        
        // Get or create session based on user type (with caching)
        if (ctx.user.type === 'authenticated') {
          const cacheKey = CACHE_KEYS.userProfile(ctx.user.id);
          session = await cache.getOrSet(
            cacheKey,
            () => getOrCreateUserSession(ctx.user.id),
            CACHE_TTL.SESSION
          );
        } else {
          const cacheKey = CACHE_KEYS.guestSession(ctx.user.id);
          session = await cache.getOrSet(
            cacheKey,
            () => getOrCreateAnonymousSession(ctx.user.id),
            CACHE_TTL.SESSION
          );
        }

        if (!session) {
          throw new Error('Failed to create or retrieve session');
        }

        // Use optimized batch update
        const answer = await dbOptimized.updateSessionAnswers(session.id, [{
          questionKey: input.questionKey,
          stepId: input.stepId,
          value: input.value,
        }]);

        // Invalidate related caches
        await cache.invalidateSession(session.id);
        
        const duration = Date.now() - start;
        console.log(`✅ Answer saved in ${duration}ms`);

        return {
          success: true,
          answer: answer[0],
          sessionId: session.id,
          performance: { duration },
        };

      } catch (error) {
        const duration = Date.now() - start;
        console.error(`Error saving answer (${duration}ms):`, error);
        throw error;
      }
    }),

  // Get session with optimized includes and caching
  getSession: guestOrAuthProcedure
    .input(z.object({
      sessionId: z.string().optional(),
      includeAnswers: z.boolean().default(true),
      includeProgress: z.boolean().default(true),
    }))
    .use(performanceMiddleware('getSession'))
    .query(async ({ input, ctx }) => {
      const start = Date.now();
      
      try {
        let session;
        
        if (input.sessionId) {
          // Get specific session with caching
          session = await dbOptimized.getAuditSession(input.sessionId, input.includeAnswers);
        } else {
          // Get current session for user
          if (ctx.user.type === 'authenticated') {
            session = await dbOptimized.getAuditSession(ctx.user.id, input.includeAnswers);
          } else {
            session = await dbOptimized.getGuestSession(ctx.user.id);
          }
        }

        if (!session) {
          return null;
        }

        let progress = null;
        if (input.includeProgress) {
          const cacheKey = CACHE_KEYS.sessionProgress(session.id);
          progress = await cache.getOrSet(
            cacheKey,
            async () => {
              const answers = session.answers || [];
              const totalSteps = 10; // From wizard config
              const completedSteps = new Set(answers.map(a => a.stepId)).size;
              
              return {
                totalSteps,
                completedSteps,
                progressPercentage: completedSteps / totalSteps,
                lastStepCompleted: Math.max(0, ...answers.map(a => parseInt(a.stepId)) || [0]),
              };
            },
            CACHE_TTL.SESSION_ANSWERS
          );
        }

        const duration = Date.now() - start;
        
        return {
          session,
          progress,
          performance: { duration },
        };

      } catch (error) {
        const duration = Date.now() - start;
        console.error(`Error getting session (${duration}ms):`, error);
        throw error;
      }
    }),

  // Get answers with caching and pagination
  getAnswers: guestOrAuthProcedure
    .input(z.object({
      sessionId: z.string(),
      stepId: z.string().optional(),
    }))
    .use(performanceMiddleware('getAnswers'))
    .query(async ({ input }) => {
      const start = Date.now();
      
      try {
        const answers = await dbOptimized.getSessionAnswers(input.sessionId);
        
        // Filter by step if specified
        const filteredAnswers = input.stepId 
          ? answers.filter(a => a.stepId === input.stepId)
          : answers;

        const duration = Date.now() - start;
        
        return {
          answers: filteredAnswers,
          total: filteredAnswers.length,
          performance: { duration },
        };

      } catch (error) {
        const duration = Date.now() - start;
        console.error(`Error getting answers (${duration}ms):`, error);
        throw error;
      }
    }),

  // Batch save answers for better performance
  saveAnswersBatch: guestOrAuthProcedure
    .input(z.object({
      sessionId: z.string(),
      answers: z.array(z.object({
        questionKey: z.string(),
        value: z.any(),
        stepId: z.string(),
      })),
    }))
    .use(performanceMiddleware('saveAnswersBatch'))
    .mutation(async ({ input }) => {
      const start = Date.now();
      
      try {
        // Use optimized batch update
        const results = await dbOptimized.updateSessionAnswers(input.sessionId, input.answers);
        
        // Invalidate related caches
        await cache.invalidateSession(input.sessionId);
        
        const duration = Date.now() - start;
        console.log(`✅ Batch answers saved: ${input.answers.length} answers in ${duration}ms`);

        return {
          success: true,
          count: results.length,
          performance: { duration },
        };

      } catch (error) {
        const duration = Date.now() - start;
        console.error(`Error batch saving answers (${duration}ms):`, error);
        throw error;
      }
    }),

  // Submit session with scoring
  submitSession: guestOrAuthProcedure
    .input(z.object({
      sessionId: z.string(),
    }))
    .use(performanceMiddleware('submitSession'))
    .mutation(async ({ input, ctx }) => {
      const start = Date.now();
      
      try {
        // Get session with answers
        const session = await dbOptimized.getAuditSession(input.sessionId, true);
        
        if (!session) {
          throw new Error('Session not found');
        }

        if (session.status !== 'DRAFT') {
          throw new Error('Session already submitted');
        }

        // Calculate scoring
        const scoringConfig = await getScoringConfig();
        const scoringResult = await scoringEngine.calculateScore(session.answers, scoringConfig);

        // Update session with score
        const updatedSession = await dbOptimized.prisma.auditSession.update({
          where: { id: input.sessionId },
          data: {
            status: 'SUBMITTED',
            score: scoringResult.totalScore,
            scoringData: scoringResult,
            completedAt: new Date(),
          },
        });

        // Invalidate all related caches
        await cache.invalidateSession(input.sessionId);
        
        if (ctx.user.type === 'authenticated') {
          await cache.invalidateUser(ctx.user.id);
        } else {
          await cache.invalidateGuest(ctx.user.id);
        }

        const duration = Date.now() - start;
        console.log(`✅ Session submitted and scored in ${duration}ms`);

        return {
          success: true,
          session: updatedSession,
          scoring: scoringResult,
          performance: { duration },
        };

      } catch (error) {
        const duration = Date.now() - start;
        console.error(`Error submitting session (${duration}ms):`, error);
        throw error;
      }
    }),

  // Get wizard configuration with heavy caching
  getWizardConfig: publicProcedure
    .use(performanceMiddleware('getWizardConfig'))
    .query(async () => {
      const start = Date.now();
      
      try {
        const cacheKey = CACHE_KEYS.wizardConfig();
        
        const config = await cache.getOrSet(
          cacheKey,
          async () => {
            // This would typically load from database or config file
            return {
              totalSteps: 10,
              steps: [
                { id: 'step_1', title: 'Company Information', questions: 5 },
                { id: 'step_2', title: 'Technical Infrastructure', questions: 8 },
                { id: 'step_3', title: 'Data & Analytics', questions: 6 },
                { id: 'step_4', title: 'Security & Compliance', questions: 7 },
                { id: 'step_5', title: 'Team & Skills', questions: 5 },
                { id: 'step_6', title: 'Operational Readiness', questions: 6 },
                { id: 'step_7', title: 'Business Strategy', questions: 4 },
                { id: 'step_8', title: 'Change Management', questions: 5 },
                { id: 'step_9', title: 'Risk Assessment', questions: 6 },
                { id: 'step_10', title: 'Future Planning', questions: 4 },
              ],
              settings: {
                allowSkip: false,
                requireAllAnswers: true,
                enableChat: true,
                autoSave: true,
              },
            };
          },
          CACHE_TTL.WIZARD_CONFIG
        );

        const duration = Date.now() - start;
        
        return {
          config,
          performance: { duration, cached: true },
        };

      } catch (error) {
        const duration = Date.now() - start;
        console.error(`Error getting wizard config (${duration}ms):`, error);
        throw error;
      }
    }),

  // Get scoring configuration with caching
  getScoringConfig: publicProcedure
    .use(performanceMiddleware('getScoringConfig'))
    .query(async () => {
      const start = Date.now();
      
      try {
        const cacheKey = CACHE_KEYS.scoringConfig();
        
        const config = await cache.getOrSet(
          cacheKey,
          () => getScoringConfig(),
          CACHE_TTL.SCORING_CONFIG
        );

        const duration = Date.now() - start;
        
        return {
          config,
          performance: { duration, cached: true },
        };

      } catch (error) {
        const duration = Date.now() - start;
        console.error(`Error getting scoring config (${duration}ms):`, error);
        throw error;
      }
    }),

  // Performance monitoring endpoint
  getPerformanceMetrics: protectedProcedure
    .query(async () => {
      const cacheMetrics = cache.getMetrics();
      const queryStats = dbOptimized.getQueryStats();
      
      return {
        cache: cacheMetrics,
        database: queryStats,
        timestamp: new Date().toISOString(),
      };
    }),
});