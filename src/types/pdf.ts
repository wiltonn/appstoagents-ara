// PDF generation types for Task 2.3: PDF Generation Service
// Supports automated report generation with scoring visualization

export interface PDFJob {
  id: string;
  sessionId: string;
  userId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  type: 'audit_report' | 'summary_report' | 'detailed_report';
  priority: 'low' | 'normal' | 'high';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
  retryCount: number;
  maxRetries: number;
  metadata?: {
    reportTitle?: string;
    customizations?: PDFCustomizations;
    requestedBy?: string;
    generationTime?: number;
    fileSize?: number;
    pageCount?: number;
  };
}

export interface PDFCustomizations {
  includeExecutiveSummary: boolean;
  includeDetailedScoring: boolean;
  includeRecommendations: boolean;
  includeActionPlan: boolean;
  includeBenchmarks: boolean;
  includeAppendix: boolean;
  logoUrl?: string;
  companyName?: string;
  brandColor?: string;
  template: 'standard' | 'executive' | 'technical' | 'minimal';
}

export interface AuditReportData {
  // Session information
  sessionId: string;
  userId?: string;
  completedAt: Date;
  
  // Wizard data
  answers: Record<string, any>;
  totalSteps: number;
  completedSteps: number[];
  
  // Scoring data
  totalScore: number;
  maxPossibleScore: number;
  pillarScores: {
    [pillarName: string]: {
      score: number;
      maxScore: number;
      percentage: number;
      level: 'beginner' | 'developing' | 'proficient' | 'advanced' | 'expert';
      questions: number;
      completedQuestions: number;
    };
  };
  
  // Analysis results
  strengths: string[];
  weaknesses: string[];
  recommendations: {
    priority: 'high' | 'medium' | 'low';
    category: string;
    title: string;
    description: string;
    estimatedEffort: string;
    expectedImpact: string;
  }[];
  
  // Benchmarking
  industryBenchmark?: {
    industry: string;
    averageScore: number;
    percentile: number;
    comparison: 'above' | 'at' | 'below';
  };
  
  // Metadata
  organizationName?: string;
  assessmentType: string;
  version: string;
  generatedAt: Date;
}

export interface PDFTemplate {
  id: string;
  name: string;
  description: string;
  type: 'standard' | 'executive' | 'technical' | 'minimal';
  components: {
    coverPage: boolean;
    executiveSummary: boolean;
    scoreOverview: boolean;
    pillarAnalysis: boolean;
    detailedFindings: boolean;
    recommendations: boolean;
    actionPlan: boolean;
    benchmarks: boolean;
    methodology: boolean;
    appendix: boolean;
  };
  styling: {
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    logoPosition: 'top-left' | 'top-center' | 'top-right';
    headerStyle: 'modern' | 'classic' | 'minimal';
  };
}

export interface PDFGenerationOptions {
  format: 'A4' | 'Letter' | 'Legal';
  orientation: 'portrait' | 'landscape';
  quality: 'draft' | 'standard' | 'high';
  compression: boolean;
  watermark?: {
    text: string;
    opacity: number;
    position: 'center' | 'corner';
  };
  security?: {
    password?: string;
    permissions: {
      printing: boolean;
      copying: boolean;
      editing: boolean;
    };
  };
}

export interface StorageInfo {
  provider: 'cloudflare-r2' | 'aws-s3' | 'local';
  bucket: string;
  key: string;
  url: string;
  signedUrl?: string;
  expiresAt?: Date;
  size: number;
  contentType: string;
  etag?: string;
  lastModified: Date;
}

export interface PDFJobResult {
  jobId: string;
  success: boolean;
  error?: string;
  file?: {
    storage: StorageInfo;
    metadata: {
      filename: string;
      size: number;
      pageCount: number;
      generationTime: number;
      template: string;
    };
  };
  downloadUrl?: string;
  expiresAt?: Date;
}

export interface QueueConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  concurrency: number;
  attempts: number;
  backoff: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
  removeOnComplete: number;
  removeOnFail: number;
}

export interface PDFGenerationMetrics {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageGenerationTime: number;
  queueLength: number;
  activeJobs: number;
  successRate: number;
  lastJobCompletedAt?: Date;
}

// Chart data for scoring visualizations
export interface ChartData {
  type: 'bar' | 'pie' | 'radar' | 'line' | 'doughnut';
  title: string;
  data: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string | string[];
      borderWidth?: number;
    }[];
  };
  options?: {
    responsive: boolean;
    plugins?: {
      legend?: {
        display: boolean;
        position?: 'top' | 'bottom' | 'left' | 'right';
      };
      title?: {
        display: boolean;
        text: string;
      };
    };
    scales?: any;
  };
}

// Email notification for PDF delivery
export interface PDFNotification {
  to: string;
  subject: string;
  template: 'pdf_ready' | 'pdf_failed';
  data: {
    recipientName?: string;
    reportTitle: string;
    downloadUrl?: string;
    expiresAt?: Date;
    error?: string;
  };
}

// Audit for PDF generation activities
export interface PDFAuditLog {
  id: string;
  jobId: string;
  action: 'created' | 'started' | 'completed' | 'failed' | 'downloaded' | 'expired';
  timestamp: Date;
  userId?: string;
  sessionId: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}