// Job Queue System for PDF Generation - Task 2.3
// Handles concurrent PDF generation with Bull and Redis

import Bull, { Queue, Job, JobOptions } from 'bull';
import type { 
  PDFJob, 
  AuditReportData, 
  PDFJobResult, 
  PDFCustomizations, 
  PDFTemplate,
  QueueConfig,
  PDFGenerationMetrics
} from '../types/pdf';
import { PDFGenerationService } from './pdfService';
import { CloudflareR2Storage } from './storage';

export class PDFJobQueue {
  private queue: Queue<PDFJob>;
  private pdfService: PDFGenerationService;
  private storage: CloudflareR2Storage;
  private isInitialized = false;

  constructor(config: QueueConfig) {
    // Initialize Bull queue with Redis
    this.queue = new Bull('pdf-generation', {
      redis: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db || 0,
      },
      defaultJobOptions: {
        attempts: config.attempts,
        backoff: {
          type: config.backoff.type,
          delay: config.backoff.delay,
        },
        removeOnComplete: config.removeOnComplete,
        removeOnFail: config.removeOnFail,
      },
    });

    this.pdfService = new PDFGenerationService();
    this.storage = new CloudflareR2Storage();
    
    this.setupJobProcessing(config.concurrency);
    this.setupEventHandlers();
  }

  // Initialize the queue system
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.pdfService.initialize();
      await this.storage.initialize();
      this.isInitialized = true;
      console.log('PDF Job Queue initialized');
    } catch (error) {
      console.error('Failed to initialize PDF Job Queue:', error);
      throw error;
    }
  }

  // Add a PDF generation job to the queue
  async addJob(
    reportData: AuditReportData,
    template: PDFTemplate,
    customizations: PDFCustomizations,
    options: JobOptions = {}
  ): Promise<string> {
    const jobId = this.generateJobId();
    
    const jobData: PDFJob = {
      id: jobId,
      sessionId: reportData.sessionId,
      userId: reportData.userId,
      status: 'pending',
      type: 'audit_report',
      priority: options.priority as 'low' | 'normal' | 'high' || 'normal',
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: 3,
      metadata: {
        reportTitle: `Agent Readiness Audit - ${customizations.companyName || 'Organization'}`,
        customizations,
        requestedBy: reportData.userId || 'guest',
      },
    };

    // Add job to queue with priority
    const job = await this.queue.add(jobData, {
      ...options,
      jobId,
      priority: this.getPriorityValue(jobData.priority),
    });

    console.log(`PDF job ${jobId} added to queue`);
    return jobId;
  }

  // Get job status
  async getJobStatus(jobId: string): Promise<PDFJob | null> {
    try {
      const job = await this.queue.getJob(jobId);
      if (!job) return null;

      return {
        ...job.data,
        status: await this.getJobState(job),
        startedAt: job.processedOn ? new Date(job.processedOn) : undefined,
        completedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
        failedAt: job.failedReason ? new Date(job.timestamp) : undefined,
        error: job.failedReason || undefined,
      };
    } catch (error) {
      console.error(`Error getting job status for ${jobId}:`, error);
      return null;
    }
  }

  // Get job result
  async getJobResult(jobId: string): Promise<PDFJobResult | null> {
    try {
      const job = await this.queue.getJob(jobId);
      if (!job) return null;

      const state = await this.getJobState(job);
      
      if (state === 'completed' && job.returnvalue) {
        return {
          jobId,
          success: true,
          file: job.returnvalue.file,
          downloadUrl: job.returnvalue.downloadUrl,
          expiresAt: job.returnvalue.expiresAt,
        };
      } else if (state === 'failed') {
        return {
          jobId,
          success: false,
          error: job.failedReason || 'Job failed without specific error',
        };
      }

      return {
        jobId,
        success: false,
        error: 'Job not completed yet',
      };
    } catch (error) {
      console.error(`Error getting job result for ${jobId}:`, error);
      return {
        jobId,
        success: false,
        error: `Error retrieving job result: ${error.message}`,
      };
    }
  }

  // Cancel a job
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.queue.getJob(jobId);
      if (!job) return false;

      await job.remove();
      console.log(`PDF job ${jobId} cancelled`);
      return true;
    } catch (error) {
      console.error(`Error cancelling job ${jobId}:`, error);
      return false;
    }
  }

  // Get queue metrics
  async getMetrics(): Promise<PDFGenerationMetrics> {
    try {
      const waiting = await this.queue.getWaiting();
      const active = await this.queue.getActive();
      const completed = await this.queue.getCompleted();
      const failed = await this.queue.getFailed();

      // Calculate average generation time from last 100 completed jobs
      const recentCompleted = completed.slice(-100);
      const totalTime = recentCompleted.reduce((sum, job) => {
        if (job.finishedOn && job.processedOn) {
          return sum + (job.finishedOn - job.processedOn);
        }
        return sum;
      }, 0);

      const averageGenerationTime = recentCompleted.length > 0 
        ? totalTime / recentCompleted.length 
        : 0;

      const lastCompletedJob = completed[completed.length - 1];

      return {
        totalJobs: waiting.length + active.length + completed.length + failed.length,
        completedJobs: completed.length,
        failedJobs: failed.length,
        averageGenerationTime,
        queueLength: waiting.length,
        activeJobs: active.length,
        successRate: completed.length > 0 
          ? (completed.length / (completed.length + failed.length)) * 100 
          : 0,
        lastJobCompletedAt: lastCompletedJob?.finishedOn 
          ? new Date(lastCompletedJob.finishedOn) 
          : undefined,
      };
    } catch (error) {
      console.error('Error getting queue metrics:', error);
      throw error;
    }
  }

  // Clean up old jobs
  async cleanupJobs(olderThan: number = 24 * 60 * 60 * 1000): Promise<void> {
    try {
      // Clean completed jobs older than specified time
      await this.queue.clean(olderThan, 'completed');
      await this.queue.clean(olderThan, 'failed');
      
      console.log(`Cleaned up jobs older than ${olderThan}ms`);
    } catch (error) {
      console.error('Error cleaning up jobs:', error);
    }
  }

  // Shutdown the queue
  async shutdown(): Promise<void> {
    try {
      await this.queue.close();
      await this.pdfService.cleanup();
      console.log('PDF Job Queue shut down');
    } catch (error) {
      console.error('Error shutting down PDF Job Queue:', error);
    }
  }

  // Setup job processing
  private setupJobProcessing(concurrency: number): void {
    this.queue.process(concurrency, async (job: Job<PDFJob>) => {
      const { data } = job;
      
      try {
        console.log(`Processing PDF job ${data.id}`);
        
        // Update job status
        await job.progress(10);
        data.status = 'processing';
        data.startedAt = new Date();

        // Get audit data and template (this would come from database)
        const reportData = await this.getReportData(data.sessionId);
        const template = await this.getTemplate(data.metadata?.customizations?.template || 'standard');
        
        await job.progress(25);

        // Generate PDF
        const pdfBuffer = await this.pdfService.generateReport(
          reportData,
          template,
          data.metadata?.customizations || this.getDefaultCustomizations(),
        );

        await job.progress(60);

        // Upload to storage
        const filename = `audit-report-${data.sessionId}-${Date.now()}.pdf`;
        const storageInfo = await this.storage.uploadFile(pdfBuffer, filename, {
          sessionId: data.sessionId,
          userId: data.userId,
          jobId: data.id,
        });

        await job.progress(80);

        // Generate signed URL for download
        const downloadUrl = await this.storage.getSignedUrl(storageInfo.key, 7 * 24 * 60 * 60); // 7 days
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await job.progress(100);

        // Update job status
        data.status = 'completed';
        data.completedAt = new Date();
        data.metadata = {
          ...data.metadata,
          generationTime: Date.now() - (data.startedAt?.getTime() || Date.now()),
          fileSize: storageInfo.size,
          pageCount: this.estimatePageCount(pdfBuffer),
        };

        console.log(`PDF job ${data.id} completed successfully`);

        return {
          file: {
            storage: storageInfo,
            metadata: {
              filename,
              size: storageInfo.size,
              pageCount: data.metadata.pageCount || 0,
              generationTime: data.metadata.generationTime || 0,
              template: template.id,
            },
          },
          downloadUrl,
          expiresAt,
        };

      } catch (error) {
        console.error(`PDF job ${data.id} failed:`, error);
        
        data.status = 'failed';
        data.failedAt = new Date();
        data.error = error.message;
        data.retryCount++;

        throw error;
      }
    });
  }

  // Setup event handlers
  private setupEventHandlers(): void {
    this.queue.on('completed', (job, result) => {
      console.log(`Job ${job.id} completed with result:`, result);
    });

    this.queue.on('failed', (job, err) => {
      console.error(`Job ${job.id} failed:`, err);
    });

    this.queue.on('stalled', (job) => {
      console.warn(`Job ${job.id} stalled`);
    });

    this.queue.on('progress', (job, progress) => {
      console.log(`Job ${job.id} progress: ${progress}%`);
    });
  }

  // Utility methods
  private generateJobId(): string {
    return `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getPriorityValue(priority: 'low' | 'normal' | 'high'): number {
    switch (priority) {
      case 'high': return 1;
      case 'normal': return 5;
      case 'low': return 10;
      default: return 5;
    }
  }

  private async getJobState(job: Job): Promise<string> {
    const state = await job.getState();
    switch (state) {
      case 'waiting': return 'pending';
      case 'active': return 'processing';
      case 'completed': return 'completed';
      case 'failed': return 'failed';
      case 'delayed': return 'pending';
      case 'stuck': return 'failed';
      default: return 'pending';
    }
  }

  // Mock methods - these would connect to actual database in production
  private async getReportData(sessionId: string): Promise<AuditReportData> {
    // TODO: Fetch from database
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
          level: 'advanced',
          questions: 10,
          completedQuestions: 10,
        },
        'Data & Analytics': {
          score: 70,
          maxScore: 100,
          percentage: 70,
          level: 'proficient',
          questions: 8,
          completedQuestions: 8,
        },
      },
      strengths: ['Strong technical infrastructure', 'Good data practices'],
      weaknesses: ['Limited AI experience', 'Governance gaps'],
      recommendations: [
        {
          priority: 'high',
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

  private async getTemplate(templateId: string): Promise<PDFTemplate> {
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

  private getDefaultCustomizations(): PDFCustomizations {
    return {
      includeExecutiveSummary: true,
      includeDetailedScoring: true,
      includeRecommendations: true,
      includeActionPlan: true,
      includeBenchmarks: false,
      includeAppendix: true,
      template: 'standard',
    };
  }

  private estimatePageCount(pdfBuffer: Buffer): number {
    // Simple estimation based on file size
    // In production, you might want to use a PDF parsing library
    const sizeKB = pdfBuffer.length / 1024;
    return Math.max(1, Math.round(sizeKB / 50)); // Rough estimate: 50KB per page
  }
}