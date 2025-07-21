// API route for PDF generation status checking
// Provides real-time status updates for PDF generation jobs

import type { APIRoute } from 'astro';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const GET: APIRoute = async ({ url }) => {
  try {
    const jobId = url.searchParams.get('jobId');
    const sessionId = url.searchParams.get('sessionId');

    if (!jobId && !sessionId) {
      return new Response(JSON.stringify({ error: 'Job ID or Session ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let job;
    
    if (jobId) {
      // Get specific job by ID
      job = await prisma.pDFJob.findUnique({
        where: { id: jobId },
      });
    } else {
      // Get latest job for session
      job = await prisma.pDFJob.findFirst({
        where: { sessionId: sessionId! },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!job) {
      return new Response(JSON.stringify({ error: 'PDF job not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Calculate progress and time estimates
    const progress = calculateProgress(job);
    const timeEstimate = calculateTimeEstimate(job);

    const response = {
      jobId: job.id,
      sessionId: job.sessionId,
      status: job.status.toLowerCase(),
      progress,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      estimatedTimeRemaining: timeEstimate,
      downloadUrl: job.status === 'COMPLETED' ? job.signedUrl : null,
      urlExpiresAt: job.status === 'COMPLETED' ? job.urlExpiresAt : null,
      error: job.errorMessage,
      retryCount: job.retryCount,
    };

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error checking PDF status:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: 'Failed to check PDF status'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { action, jobId } = body;

    if (!jobId) {
      return new Response(JSON.stringify({ error: 'Job ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const job = await prisma.pDFJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return new Response(JSON.stringify({ error: 'PDF job not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    switch (action) {
      case 'cancel':
        if (job.status === 'PENDING' || job.status === 'PROCESSING') {
          await prisma.pDFJob.update({
            where: { id: jobId },
            data: { status: 'CANCELLED' },
          });
          return new Response(JSON.stringify({ message: 'Job cancelled successfully' }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({ error: 'Job cannot be cancelled in current status' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

      case 'retry':
        if (job.status === 'FAILED' && job.retryCount < 3) {
          await prisma.pDFJob.update({
            where: { id: jobId },
            data: { 
              status: 'PENDING',
              retryCount: job.retryCount + 1,
              errorMessage: null,
            },
          });
          // Re-queue the job
          await queuePDFGeneration(jobId);
          return new Response(JSON.stringify({ message: 'Job queued for retry' }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({ error: 'Job cannot be retried' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

      case 'regenerate_url':
        if (job.status === 'COMPLETED' && job.r2Key) {
          // Generate new signed URL
          const newSignedUrl = await generateSignedUrl(job.r2Key);
          const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
          
          await prisma.pDFJob.update({
            where: { id: jobId },
            data: {
              signedUrl: newSignedUrl,
              urlExpiresAt: newExpiresAt,
            },
          });

          return new Response(JSON.stringify({
            downloadUrl: newSignedUrl,
            expiresAt: newExpiresAt,
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({ error: 'Cannot regenerate URL for this job' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }

  } catch (error) {
    console.error('Error handling PDF job action:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: 'Failed to perform action'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Calculate job progress percentage
function calculateProgress(job: any): number {
  switch (job.status) {
    case 'PENDING': return 0;
    case 'PROCESSING': {
      // Estimate progress based on time elapsed
      if (!job.startedAt) return 10;
      const elapsed = Date.now() - new Date(job.startedAt).getTime();
      const estimatedTotal = 5 * 60 * 1000; // 5 minutes estimated
      return Math.min(90, 10 + Math.floor((elapsed / estimatedTotal) * 80));
    }
    case 'COMPLETED': return 100;
    case 'FAILED':
    case 'CANCELLED': return 0;
    default: return 0;
  }
}

// Calculate estimated time remaining
function calculateTimeEstimate(job: any): string | null {
  if (job.status !== 'PROCESSING' || !job.startedAt) return null;
  
  const elapsed = Date.now() - new Date(job.startedAt).getTime();
  const estimatedTotal = 5 * 60 * 1000; // 5 minutes estimated
  const remaining = Math.max(0, estimatedTotal - elapsed);
  
  if (remaining < 60000) return `${Math.ceil(remaining / 1000)}s`;
  return `${Math.ceil(remaining / 60000)}m`;
}

// Queue PDF generation (placeholder)
async function queuePDFGeneration(jobId: string): Promise<void> {
  console.log(`Re-queuing PDF generation for job ${jobId}`);
  // This would integrate with the actual job queue system
}

// Generate signed URL using R2 storage service
async function generateSignedUrl(r2Key: string): Promise<string> {
  try {
    const { storage } = await import('../../../lib/storage');
    return await storage.getSignedUrl(r2Key, 24 * 60 * 60); // 24 hours
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw new Error('Failed to generate signed URL');
  }
}