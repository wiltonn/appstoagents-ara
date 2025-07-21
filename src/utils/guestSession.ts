// Guest Session Management Utilities
// Part of Task 2.4: Guest User Flow Enhancement

import { PrismaClient } from '@prisma/client';
import { generateAnonymousId } from './db';

const prisma = new PrismaClient();

/**
 * Guest session persistence settings
 */
export const GUEST_SESSION_CONFIG = {
  // Cookie expiration (30 days)
  COOKIE_MAX_AGE: 30 * 24 * 60 * 60 * 1000,
  
  // Session cleanup policies
  CLEANUP_AFTER_DAYS: 30,
  PRESERVE_WITH_EMAIL_DAYS: 90,
  
  // Progress thresholds for account prompts
  ACCOUNT_PROMPT_THRESHOLD: 0.5, // 50% completion
  EMAIL_CAPTURE_THRESHOLD: 0.8,  // 80% completion
} as const;

/**
 * Enhanced guest session creation with better tracking
 */
export async function createGuestSession(
  companyName?: string,
  sourceUrl?: string
) {
  const anonymousId = generateAnonymousId();
  
  const session = await prisma.auditSession.create({
    data: {
      anonymousId,
      companyName: companyName || null,
      status: 'DRAFT',
      // Store metadata about session creation
      scoringData: {
        sourceUrl,
        userAgent: '', // Would be filled from request headers
        createdFromGuest: true,
        sessionVersion: '2.4',
      },
    },
    include: {
      answers: true,
      _count: {
        select: {
          chatMessages: true,
        },
      },
    },
  });

  return { session, anonymousId };
}

/**
 * Get guest session with progress calculation
 */
export async function getGuestSessionWithProgress(anonymousId: string) {
  const session = await prisma.auditSession.findUnique({
    where: { anonymousId },
    include: {
      answers: true,
      _count: {
        select: {
          chatMessages: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  // Calculate progress metrics
  const totalSteps = 10; // From wizard config
  const completedSteps = new Set(session.answers.map(a => a.stepId)).size;
  const progressPercentage = completedSteps / totalSteps;

  return {
    ...session,
    progress: {
      totalSteps,
      completedSteps,
      progressPercentage,
      lastStepCompleted: Math.max(0, ...session.answers.map(a => parseInt(a.stepId)) || [0]),
      shouldPromptForAccount: progressPercentage >= GUEST_SESSION_CONFIG.ACCOUNT_PROMPT_THRESHOLD,
      shouldPromptForEmail: progressPercentage >= GUEST_SESSION_CONFIG.EMAIL_CAPTURE_THRESHOLD,
    },
  };
}

/**
 * Update guest session with email capture
 */
export async function captureGuestEmail(
  sessionId: string,
  email: string,
  companyName?: string
) {
  const session = await prisma.auditSession.update({
    where: { id: sessionId },
    data: {
      guestEmail: email,
      emailCapturedAt: new Date(),
      companyName: companyName || undefined,
    },
  });

  // Log for analytics
  console.log(`📧 Guest email captured: ${email} for session ${sessionId}`);
  
  return session;
}

/**
 * Check if guest session should be preserved
 */
export async function shouldPreserveGuestSession(anonymousId: string): Promise<boolean> {
  const session = await prisma.auditSession.findUnique({
    where: { anonymousId },
    select: {
      guestEmail: true,
      emailCapturedAt: true,
      answers: { select: { id: true } },
      updatedAt: true,
    },
  });

  if (!session) return false;

  // Always preserve if email was captured
  if (session.guestEmail) return true;

  // Preserve if session has significant progress and is recent
  const hasProgress = session.answers.length > 0;
  const isRecent = session.updatedAt > new Date(Date.now() - GUEST_SESSION_CONFIG.CLEANUP_AFTER_DAYS * 24 * 60 * 60 * 1000);

  return hasProgress && isRecent;
}

/**
 * Get guest sessions eligible for cleanup
 */
export async function getGuestSessionsForCleanup(options: {
  olderThanDays?: number;
  includeWithEmail?: boolean;
  limit?: number;
} = {}) {
  const {
    olderThanDays = GUEST_SESSION_CONFIG.CLEANUP_AFTER_DAYS,
    includeWithEmail = false,
    limit = 1000,
  } = options;

  const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  const whereClause: any = {
    anonymousId: { not: null },
    updatedAt: { lt: cutoffDate },
  };

  // Optionally exclude sessions with email
  if (!includeWithEmail) {
    whereClause.guestEmail = null;
  }

  return prisma.auditSession.findMany({
    where: whereClause,
    take: limit,
    orderBy: { updatedAt: 'asc' },
    include: {
      _count: {
        select: {
          answers: true,
          chatMessages: true,
        },
      },
    },
  });
}

/**
 * Enhanced session conversion with data validation
 */
export async function convertGuestToUserSession(
  anonymousId: string,
  userId: string,
  preserveEmail: boolean = true
) {
  return await prisma.$transaction(async (tx) => {
    // Find the guest session
    const guestSession = await tx.auditSession.findUnique({
      where: { anonymousId },
      include: { 
        answers: true, 
        chatMessages: true,
      },
    });

    if (!guestSession) {
      throw new Error('Guest session not found');
    }

    // Check for existing user session
    const existingUserSession = await tx.auditSession.findFirst({
      where: { userId, status: 'DRAFT' },
    });

    if (existingUserSession) {
      // If user has existing session, merge the data
      console.log(`Merging guest session ${anonymousId} into existing user session ${existingUserSession.id}`);
      
      // Move answers to user session (avoiding duplicates)
      for (const answer of guestSession.answers) {
        await tx.auditAnswer.upsert({
          where: {
            unique_session_question: {
              auditSessionId: existingUserSession.id,
              questionKey: answer.questionKey,
            },
          },
          update: {
            value: answer.value as any,
            updatedAt: new Date(),
          },
          create: {
            auditSessionId: existingUserSession.id,
            questionKey: answer.questionKey,
            stepId: answer.stepId,
            value: answer.value as any,
          },
        });
      }

      // Move chat messages
      await tx.chatMessage.updateMany({
        where: { auditSessionId: guestSession.id },
        data: { auditSessionId: existingUserSession.id },
      });

      // Update user session with guest metadata if needed
      const updateData: any = { updatedAt: new Date() };
      if (preserveEmail && guestSession.guestEmail && !existingUserSession.guestEmail) {
        updateData.guestEmail = guestSession.guestEmail;
        updateData.emailCapturedAt = guestSession.emailCapturedAt;
      }
      if (guestSession.companyName && !existingUserSession.companyName) {
        updateData.companyName = guestSession.companyName;
      }

      const updatedSession = await tx.auditSession.update({
        where: { id: existingUserSession.id },
        data: updateData,
        include: {
          answers: true,
          user: true,
          _count: {
            select: { chatMessages: true },
          },
        },
      });

      // Delete the guest session
      await tx.auditSession.delete({
        where: { id: guestSession.id },
      });

      return updatedSession;
    } else {
      // Convert guest session directly to user session
      const convertedSession = await tx.auditSession.update({
        where: { id: guestSession.id },
        data: {
          userId,
          anonymousId: null,
          updatedAt: new Date(),
        },
        include: {
          answers: true,
          user: true,
          _count: {
            select: { chatMessages: true },
          },
        },
      });

      return convertedSession;
    }
  });
}

/**
 * Generate session analytics for guest user experience
 */
export async function getGuestSessionAnalytics(days: number = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [
    totalGuestSessions,
    completedGuestSessions,
    emailCaptured,
    converted,
  ] = await Promise.all([
    // Total guest sessions
    prisma.auditSession.count({
      where: {
        anonymousId: { not: null },
        startedAt: { gte: since },
      },
    }),

    // Completed guest sessions
    prisma.auditSession.count({
      where: {
        anonymousId: { not: null },
        startedAt: { gte: since },
        status: { in: ['SUBMITTED', 'SCORED', 'REPORT_READY'] },
      },
    }),

    // Sessions with email captured
    prisma.auditSession.count({
      where: {
        anonymousId: { not: null },
        startedAt: { gte: since },
        guestEmail: { not: null },
      },
    }),

    // Converted sessions (started as guest, now have userId)
    prisma.auditSession.count({
      where: {
        userId: { not: null },
        startedAt: { gte: since },
        scoringData: {
          path: ['createdFromGuest'],
          equals: true,
        },
      },
    }),

    // Average progress calculation would require more complex query
    Promise.resolve(0),
  ]);

  return {
    period: `${days} days`,
    metrics: {
      totalGuestSessions,
      completedGuestSessions,
      emailCaptured,
      converted,
      completionRate: totalGuestSessions > 0 ? completedGuestSessions / totalGuestSessions : 0,
      emailCaptureRate: totalGuestSessions > 0 ? emailCaptured / totalGuestSessions : 0,
      conversionRate: totalGuestSessions > 0 ? converted / totalGuestSessions : 0,
    },
  };
}