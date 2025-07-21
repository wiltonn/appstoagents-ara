import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { PDFJobQueue } from '../../lib/jobQueue';
import type { PDFCustomizations, PDFTemplate } from '../../types/pdf';

// Initialize PDF job queue (in production, this would be a singleton)
const pdfQueue = new PDFJobQueue({
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
  concurrency: 3,
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 50,
});

// Validation schemas
const customizationsSchema = z.object({
  includeExecutiveSummary: z.boolean().default(true),
  includeDetailedScoring: z.boolean().default(true),
  includeRecommendations: z.boolean().default(true),
  includeActionPlan: z.boolean().default(true),
  includeBenchmarks: z.boolean().default(false),
  includeAppendix: z.boolean().default(true),
  logoUrl: z.string().url().optional(),
  companyName: z.string().optional(),
  brandColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  template: z.enum(['standard', 'executive', 'technical', 'minimal']).default('standard'),
});

export const reportsRouter = router({
  // Generate PDF report
  generateReport: publicProcedure
    .input(z.object({
      sessionId: z.string(),
      customizations: customizationsSchema.optional(),
      priority: z.enum(['low', 'normal', 'high']).default('normal'),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const { sessionId, customizations = {}, priority } = input;

        // Initialize queue if needed
        await pdfQueue.initialize();

        // Get report data from database
        // TODO: Implement actual database query
        const reportData = await getAuditReportData(sessionId);
        
        if (!reportData) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Audit session not found',
          });
        }

        // Get template
        const template = await getTemplate(customizations.template || 'standard');

        // Add job to queue
        const jobId = await pdfQueue.addJob(
          reportData,
          template,
          customizations as PDFCustomizations,
          { priority }
        );

        return {
          jobId,
          status: 'queued',
          message: 'PDF generation job has been queued',
          estimatedTime: '2-5 minutes',
        };
      } catch (error) {
        console.error('Error generating report:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to queue PDF generation job',
          cause: error,
        });
      }
    }),

  // Get job status
  getJobStatus: publicProcedure
    .input(z.object({
      jobId: z.string(),
    }))
    .query(async ({ input }) => {
      try {
        const jobStatus = await pdfQueue.getJobStatus(input.jobId);
        
        if (!jobStatus) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Job not found',
          });
        }

        return {
          jobId: input.jobId,
          status: jobStatus.status,
          createdAt: jobStatus.createdAt,
          startedAt: jobStatus.startedAt,
          completedAt: jobStatus.completedAt,
          failedAt: jobStatus.failedAt,
          error: jobStatus.error,
          metadata: jobStatus.metadata,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        console.error('Error getting job status:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get job status',
          cause: error,
        });
      }
    }),

  // Get download URL for completed PDF
  getDownloadUrl: publicProcedure
    .input(z.object({
      jobId: z.string(),
    }))
    .query(async ({ input }) => {
      try {
        const result = await pdfQueue.getJobResult(input.jobId);
        
        if (!result) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Job result not found',
          });
        }

        if (!result.success) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: result.error || 'Job failed',
          });
        }

        return {
          downloadUrl: result.downloadUrl,
          expiresAt: result.expiresAt,
          filename: result.file?.metadata.filename,
          size: result.file?.metadata.size,
          pageCount: result.file?.metadata.pageCount,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        console.error('Error getting download URL:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get download URL',
          cause: error,
        });
      }
    }),

  // Get queue metrics (admin)
  getQueueMetrics: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        // TODO: Add proper admin authorization check
        const metrics = await pdfQueue.getMetrics();
        return metrics;
      } catch (error) {
        console.error('Error getting queue metrics:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get queue metrics',
          cause: error,
        });
      }
    }),

  // Cancel PDF generation job
  cancelJob: publicProcedure
    .input(z.object({
      jobId: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const success = await pdfQueue.cancelJob(input.jobId);
        
        if (!success) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Failed to cancel job or job not found',
          });
        }

        return {
          success: true,
          message: 'Job cancelled successfully',
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        console.error('Error cancelling job:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to cancel job',
          cause: error,
        });
      }
    }),

  // Legacy endpoints for backward compatibility
  getReport: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      // TODO: Check if there's already a completed PDF for this session
      console.log('Getting report for session:', input.sessionId);
      
      return {
        url: null,
        status: 'pending',
        message: 'Use generateReport endpoint to create PDF',
      };
    }),

  getStatus: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      // TODO: Check latest job status for this session
      console.log('Getting PDF status for session:', input.sessionId);
      
      return {
        status: 'pending',
        progress: 0,
        estimatedCompletion: null,
      };
    }),
});

// Helper functions
async function getAuditReportData(sessionId: string) {
  // TODO: Implement actual database query
  // This is a mock implementation
  return {
    sessionId,
    completedAt: new Date(),
    answers: {},
    totalSteps: 5,
    completedSteps: [1, 2, 3, 4, 5],
    totalScore: 75,
    maxPossibleScore: 100,
    pillarScores: {
      'Technical Infrastructure': {
        score: 80,
        maxScore: 100,
        percentage: 80,
        level: 'advanced' as const,
        questions: 10,
        completedQuestions: 10,
      },
      'Data & Analytics': {
        score: 70,
        maxScore: 100,
        percentage: 70,
        level: 'proficient' as const,
        questions: 8,
        completedQuestions: 8,
      },
    },
    strengths: ['Strong technical infrastructure', 'Good data practices'],
    weaknesses: ['Limited AI experience', 'Governance gaps'],
    recommendations: [
      {
        priority: 'high' as const,
        category: 'Technical',
        title: 'Implement AI governance framework',
        description: 'Establish clear policies and procedures for AI development and deployment.',
        estimatedEffort: '2-3 months',
        expectedImpact: 'High',
      },
    ],
    assessmentType: 'Agent Readiness Audit',
    version: '1.0.0',
    generatedAt: new Date(),
  };
}

async function getTemplate(templateId: string): Promise<PDFTemplate> {
  // TODO: Fetch from database
  return {
    id: templateId,
    name: 'Standard Report',
    description: 'Comprehensive audit report with all sections',
    type: 'standard',
    components: {
      coverPage: true,
      executiveSummary: true,
      scoreOverview: true,
      pillarAnalysis: true,
      detailedFindings: true,
      recommendations: true,
      actionPlan: true,
      benchmarks: true,
      methodology: true,
      appendix: true,
    },
    styling: {
      primaryColor: '#3B82F6',
      secondaryColor: '#1E40AF',
      fontFamily: 'Inter',
      logoPosition: 'top-left',
      headerStyle: 'modern',
    },
  };
}