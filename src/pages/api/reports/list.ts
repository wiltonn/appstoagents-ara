// API route for listing PDF reports
// Provides report history and management capabilities

import type { APIRoute } from 'astro';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const GET: APIRoute = async ({ url }) => {
  try {
    const sessionId = url.searchParams.get('sessionId');
    const userId = url.searchParams.get('userId');
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    if (!sessionId && !userId) {
      return new Response(JSON.stringify({ error: 'Session ID or User ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build where clause
    const where: any = {};
    if (sessionId) where.sessionId = sessionId;
    if (status) where.status = status.toUpperCase();

    // If userId is provided, filter by sessions belonging to that user
    if (userId && !sessionId) {
      const userSessions = await prisma.auditSession.findMany({
        where: { userId },
        select: { id: true },
      });
      where.sessionId = {
        in: userSessions.map(s => s.id),
      };
    }

    // Get PDF jobs with pagination
    const [jobs, totalCount] = await Promise.all([
      prisma.pDFJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          auditSession: {
            select: {
              id: true,
              companyName: true,
              createdAt: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
      prisma.pDFJob.count({ where }),
    ]);

    // Format response
    const reports = jobs.map(job => ({
      jobId: job.id,
      sessionId: job.sessionId,
      status: job.status.toLowerCase(),
      priority: job.priority.toLowerCase(),
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      downloadUrl: job.status === 'COMPLETED' ? job.signedUrl : null,
      urlExpiresAt: job.status === 'COMPLETED' ? job.urlExpiresAt : null,
      error: job.errorMessage,
      retryCount: job.retryCount,
      session: {
        id: job.auditSession?.id,
        companyName: job.auditSession?.companyName,
        createdAt: job.auditSession?.createdAt,
        user: job.auditSession?.user,
      },
      // Extract metadata from template data
      metadata: extractMetadata(job.templateData),
    }));

    return new Response(JSON.stringify({
      reports,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error listing PDF reports:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: 'Failed to list PDF reports'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { jobId, sessionId } = body;

    if (!jobId && !sessionId) {
      return new Response(JSON.stringify({ error: 'Job ID or Session ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (jobId) {
      // Delete specific job
      const job = await prisma.pDFJob.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        return new Response(JSON.stringify({ error: 'PDF job not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Delete from R2 storage if file exists
      if (job.r2Key && job.status === 'COMPLETED') {
        await deleteFromStorage(job.r2Key);
      }

      // Delete job from database
      await prisma.pDFJob.delete({
        where: { id: jobId },
      });

      return new Response(JSON.stringify({ message: 'Report deleted successfully' }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } else {
      // Delete all jobs for session
      const jobs = await prisma.pDFJob.findMany({
        where: { sessionId: sessionId! },
      });

      // Delete files from storage
      for (const job of jobs) {
        if (job.r2Key && job.status === 'COMPLETED') {
          await deleteFromStorage(job.r2Key);
        }
      }

      // Delete all jobs from database
      const result = await prisma.pDFJob.deleteMany({
        where: { sessionId: sessionId! },
      });

      return new Response(JSON.stringify({ 
        message: `${result.count} report(s) deleted successfully` 
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Error deleting PDF reports:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: 'Failed to delete PDF reports'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Extract metadata from template data
function extractMetadata(templateData: any): any {
  if (!templateData || typeof templateData !== 'object') {
    return {};
  }

  return {
    organizationName: templateData.organizationName,
    totalScore: templateData.totalScore,
    assessmentType: templateData.assessmentType,
    completedSteps: templateData.completedSteps?.length || 0,
    totalSteps: templateData.totalSteps || 0,
    customizations: templateData.customizations,
  };
}

// Delete file from R2 storage
async function deleteFromStorage(r2Key: string): Promise<void> {
  try {
    const { storage } = await import('../../../lib/storage');
    const success = await storage.deleteFile(r2Key);
    
    if (success) {
      console.log(`Successfully deleted file from R2 storage: ${r2Key}`);
    } else {
      console.warn(`Failed to delete file from R2 storage: ${r2Key}`);
    }
  } catch (error) {
    console.error(`Error deleting file from storage: ${r2Key}`, error);
    // Don't throw error - we still want to delete the database record
  }
}