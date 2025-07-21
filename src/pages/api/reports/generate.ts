// API route for PDF report generation
// Handles automated PDF report generation with queue processing

import type { APIRoute } from 'astro';
import { PrismaClient } from '@prisma/client';
import type { PDFJob, PDFCustomizations } from '../../../types/pdf';

const prisma = new PrismaClient();

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { 
      sessionId, 
      userId, 
      type = 'audit_report', 
      priority = 'normal',
      customizations 
    } = body;

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Session ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if audit session exists and is completed
    const auditSession = await prisma.auditSession.findUnique({
      where: { id: sessionId },
      include: {
        answers: true,
        chatMessages: true,
      },
    });

    if (!auditSession) {
      return new Response(JSON.stringify({ error: 'Audit session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (auditSession.status !== 'COMPLETED') {
      return new Response(JSON.stringify({ error: 'Audit session must be completed before generating report' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check for existing pending/processing job
    const existingJob = await prisma.pDFJob.findFirst({
      where: {
        sessionId,
        status: {
          in: ['PENDING', 'PROCESSING']
        },
      },
    });

    if (existingJob) {
      return new Response(JSON.stringify({ 
        jobId: existingJob.id,
        status: existingJob.status,
        message: 'Report generation already in progress'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Prepare template data
    const templateData = await prepareTemplateData(sessionId, customizations);

    // Create PDF job in database
    const pdfJob = await prisma.pDFJob.create({
      data: {
        sessionId,
        status: 'PENDING',
        priority: mapPriority(priority),
        templateData,
        retryCount: 0,
      },
    });

    // Queue the job for processing
    await queuePDFGeneration(pdfJob.id);

    return new Response(JSON.stringify({
      jobId: pdfJob.id,
      status: 'pending',
      message: 'PDF generation queued successfully',
      estimatedTime: '2-5 minutes'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating PDF report:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: 'Failed to queue PDF generation'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Prepare template data for PDF generation
async function prepareTemplateData(sessionId: string, customizations?: PDFCustomizations) {
  const auditSession = await prisma.auditSession.findUnique({
    where: { id: sessionId },
    include: {
      answers: {
        orderBy: { createdAt: 'asc' }
      },
      user: true,
    },
  });

  if (!auditSession) {
    throw new Error('Audit session not found');
  }

  // Calculate scores (this would use the actual scoring service)
  const mockScores = {
    totalScore: 78,
    maxPossibleScore: 100,
    pillarScores: {
      'Technical Readiness': {
        score: 85,
        maxScore: 100,
        percentage: 85,
        level: 'proficient' as const,
        questions: 12,
        completedQuestions: 12,
      },
      'Operational Readiness': {
        score: 72,
        maxScore: 100,
        percentage: 72,
        level: 'developing' as const,
        questions: 10,
        completedQuestions: 10,
      },
      'Security & Compliance': {
        score: 76,
        maxScore: 100,
        percentage: 76,
        level: 'proficient' as const,
        questions: 8,
        completedQuestions: 8,
      },
    },
  };

  // Build template data
  const templateData = {
    // Session information
    sessionId: auditSession.id,
    userId: auditSession.userId,
    completedAt: auditSession.updatedAt,
    
    // Organization information
    organizationName: auditSession.companyName || 'Your Organization',
    assessmentType: 'Agent Readiness Audit',
    version: '1.0',
    generatedAt: new Date(),
    
    // Wizard data
    answers: auditSession.answers.reduce((acc, answer) => {
      acc[answer.questionId] = answer.value;
      return acc;
    }, {} as Record<string, any>),
    totalSteps: 10, // This would come from wizard config
    completedSteps: auditSession.answers.map(a => a.stepId).filter((v, i, a) => a.indexOf(v) === i),
    
    // Scoring data
    ...mockScores,
    
    // Analysis results
    strengths: [
      'Strong technical infrastructure with cloud-native architecture',
      'Established API ecosystem ready for agent integration',
      'Good data governance practices in place',
    ],
    weaknesses: [
      'Limited experience with AI/ML model deployment',
      'Need for enhanced monitoring and observability',
      'Security policies require updates for AI workloads',
    ],
    recommendations: [
      {
        priority: 'high' as const,
        category: 'Technical Infrastructure',
        title: 'Implement AI Model Deployment Pipeline',
        description: 'Establish a robust pipeline for deploying and managing AI models in production',
        estimatedEffort: '4-6 weeks',
        expectedImpact: 'High - Enables rapid agent deployment',
      },
      {
        priority: 'medium' as const,
        category: 'Security',
        title: 'Update Security Policies for AI Workloads',
        description: 'Revise security policies to address AI-specific risks and compliance requirements',
        estimatedEffort: '2-3 weeks',
        expectedImpact: 'Medium - Ensures secure agent operations',
      },
    ],
    
    // Benchmarking (mock data)
    industryBenchmark: {
      industry: 'Technology',
      averageScore: 72,
      percentile: 65,
      comparison: 'above' as const,
    },
    
    // Customizations
    customizations: {
      includeExecutiveSummary: true,
      includeDetailedScoring: true,
      includeRecommendations: true,
      includeActionPlan: true,
      includeBenchmarks: true,
      includeAppendix: false,
      template: 'standard',
      ...customizations,
    },
  };

  return templateData;
}

// Map priority string to enum
function mapPriority(priority: string): 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' {
  switch (priority.toUpperCase()) {
    case 'LOW': return 'LOW';
    case 'HIGH': return 'HIGH';
    case 'URGENT': return 'URGENT';
    default: return 'NORMAL';
  }
}

// Queue PDF generation job (placeholder - would integrate with actual queue)
async function queuePDFGeneration(jobId: string): Promise<void> {
  // This would integrate with the actual job queue system (Bull/Redis)
  console.log(`Queuing PDF generation for job ${jobId}`);
  
  // For now, we'll simulate queuing by updating the job status
  // In production, this would add the job to the Bull queue
  
  // Simulate async processing
  setTimeout(async () => {
    try {
      await processPDFJob(jobId);
    } catch (error) {
      console.error(`Error processing PDF job ${jobId}:`, error);
      await prisma.pDFJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }, 1000);
}

// Process PDF job (actual implementation)
async function processPDFJob(jobId: string): Promise<void> {
  try {
    // Update job status to processing
    await prisma.pDFJob.update({
      where: { id: jobId },
      data: {
        status: 'PROCESSING',
        startedAt: new Date(),
      },
    });

    // Get job data and generate PDF
    const job = await prisma.pDFJob.findUnique({
      where: { id: jobId },
      include: {
        auditSession: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!job) {
      throw new Error('Job not found');
    }

    // Generate PDF using the PDF service
    const { PDFGenerationService } = await import('../../../lib/pdfService');
    const { reportTemplateService } = await import('../../../lib/reportTemplateService');
    
    const pdfService = new PDFGenerationService();
    await pdfService.initialize();

    try {
      // Convert template data to proper types
      const reportData = job.templateData;
      const template = reportTemplateService.getDefaultTemplate();
      const customizations = reportData.customizations || {};

      // Generate PDF buffer
      const pdfBuffer = await pdfService.generateReport(
        reportData,
        template,
        customizations
      );

      // Upload to R2 storage
      const { storage } = await import('../../../lib/storage');
      const filename = `audit-report-${job.sessionId}-${Date.now()}.pdf`;
      
      const storageInfo = await storage.uploadFile(pdfBuffer, filename, {
        sessionId: job.sessionId,
        userId: job.auditSession?.userId,
        jobId: job.id,
        contentType: 'application/pdf',
        tags: {
          type: 'audit-report',
          companyName: job.auditSession?.companyName || 'unknown',
        },
      });

      // Generate signed URL for download (24 hour expiry)
      const signedUrl = await storage.getSignedUrl(storageInfo.key, 24 * 60 * 60);
      const urlExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Update job as completed
      await prisma.pDFJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          r2Key: storageInfo.key,
          signedUrl,
          urlExpiresAt,
        },
      });

      console.log(`PDF generation completed for job ${jobId}`);
      
    } finally {
      await pdfService.cleanup();
    }

  } catch (error) {
    console.error(`Error processing PDF job ${jobId}:`, error);
    
    // Update job as failed
    await prisma.pDFJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    
    throw error;
  }
}