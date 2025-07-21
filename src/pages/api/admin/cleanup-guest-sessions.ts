// API endpoint for guest session cleanup and data retention
// Part of Task 2.4: Guest User Flow Enhancement

import type { APIRoute } from 'astro';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const POST: APIRoute = async ({ request }) => {
  try {
    // Basic authentication check (in production, this would use proper admin auth)
    const authHeader = request.headers.get('authorization');
    const adminKey = process.env.ADMIN_API_KEY;
    
    if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
      return new Response(JSON.stringify({ 
        error: 'Unauthorized' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { 
      dryRun = true, 
      olderThanDays = 30,
      includeWithEmail = false 
    } = body;

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    // Build where clause for guest sessions to cleanup
    const whereClause: any = {
      anonymousId: { not: null }, // Only guest sessions
      updatedAt: { lt: cutoffDate }, // Older than specified days
    };

    // Optionally exclude sessions with captured emails
    if (!includeWithEmail) {
      whereClause.guestEmail = null;
    }

    // Get sessions that would be affected
    const sessionsToCleanup = await prisma.auditSession.findMany({
      where: whereClause,
      include: {
        answers: true,
        chatMessages: true,
        _count: {
          select: {
            answers: true,
            chatMessages: true,
          },
        },
      },
    });

    // Calculate cleanup statistics
    const stats = {
      sessionsToDelete: sessionsToCleanup.length,
      answersToDelete: sessionsToCleanup.reduce((sum, session) => sum + session._count.answers, 0),
      messagesToDelete: sessionsToCleanup.reduce((sum, session) => sum + session._count.chatMessages, 0),
      oldestSession: sessionsToCleanup.length > 0 
        ? Math.min(...sessionsToCleanup.map(s => s.updatedAt.getTime()))
        : null,
      newestSession: sessionsToCleanup.length > 0 
        ? Math.max(...sessionsToCleanup.map(s => s.updatedAt.getTime()))
        : null,
    };

    if (dryRun) {
      // Return what would be deleted without actually deleting
      return new Response(JSON.stringify({
        dryRun: true,
        cutoffDate,
        criteria: {
          olderThanDays,
          includeWithEmail,
        },
        stats,
        message: `Would delete ${stats.sessionsToDelete} guest sessions and associated data`,
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Perform actual cleanup
    let deletedCount = 0;
    const batchSize = 100;

    // Process in batches to avoid timeout
    for (let i = 0; i < sessionsToCleanup.length; i += batchSize) {
      const batch = sessionsToCleanup.slice(i, i + batchSize);
      const sessionIds = batch.map(s => s.id);

      await prisma.$transaction(async (tx) => {
        // Delete related data first (cascade should handle this, but being explicit)
        await tx.chatMessage.deleteMany({
          where: { auditSessionId: { in: sessionIds } },
        });

        await tx.auditAnswer.deleteMany({
          where: { auditSessionId: { in: sessionIds } },
        });

        // Delete sessions
        await tx.auditSession.deleteMany({
          where: { id: { in: sessionIds } },
        });
      });

      deletedCount += batch.length;
      console.log(`🧹 Deleted batch of ${batch.length} guest sessions (${deletedCount}/${sessionsToCleanup.length})`);
    }

    console.log(`✅ Guest session cleanup completed: ${deletedCount} sessions deleted`);

    return new Response(JSON.stringify({
      success: true,
      cutoffDate,
      criteria: {
        olderThanDays,
        includeWithEmail,
      },
      stats: {
        ...stats,
        actuallyDeleted: deletedCount,
      },
      message: `Successfully deleted ${deletedCount} guest sessions and associated data`,
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error during guest session cleanup:', error);
    return new Response(JSON.stringify({
      error: 'Cleanup failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Get cleanup statistics without performing cleanup
export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const olderThanDays = parseInt(url.searchParams.get('olderThanDays') || '30');
    const includeWithEmail = url.searchParams.get('includeWithEmail') === 'true';

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    // Get guest session statistics
    const [totalGuestSessions, oldGuestSessions, oldWithEmail, oldWithoutEmail] = await Promise.all([
      // Total guest sessions
      prisma.auditSession.count({
        where: { anonymousId: { not: null } },
      }),
      
      // Old guest sessions (eligible for cleanup)
      prisma.auditSession.count({
        where: {
          anonymousId: { not: null },
          updatedAt: { lt: cutoffDate },
        },
      }),
      
      // Old sessions with email
      prisma.auditSession.count({
        where: {
          anonymousId: { not: null },
          updatedAt: { lt: cutoffDate },
          guestEmail: { not: null },
        },
      }),
      
      // Old sessions without email
      prisma.auditSession.count({
        where: {
          anonymousId: { not: null },
          updatedAt: { lt: cutoffDate },
          guestEmail: null,
        },
      }),
    ]);

    return new Response(JSON.stringify({
      cutoffDate,
      criteria: { olderThanDays, includeWithEmail },
      statistics: {
        totalGuestSessions,
        oldGuestSessions,
        oldWithEmail,
        oldWithoutEmail,
        eligibleForCleanup: includeWithEmail ? oldGuestSessions : oldWithoutEmail,
      },
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting cleanup statistics:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};