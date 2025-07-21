// Test file for PDF Generation Service - Task 2.3
// This file can be used to test the PDF generation workflow

import { PDFGenerationService } from '../lib/pdfService';
import { reportTemplateService } from '../lib/reportTemplateService';
import { storage } from '../lib/storage';
import type { AuditReportData, PDFCustomizations } from '../types/pdf';

/**
 * Test data for PDF generation
 */
const mockReportData: AuditReportData = {
  sessionId: 'test-session-123',
  userId: 'test-user-456',
  completedAt: new Date(),
  organizationName: 'Test Organization Inc.',
  assessmentType: 'Agent Readiness Audit',
  version: '1.0',
  generatedAt: new Date(),
  
  totalScore: 78,
  maxPossibleScore: 100,
  
  pillarScores: {
    'Technical Readiness': {
      score: 85,
      maxScore: 100,
      percentage: 85,
      level: 'proficient',
      questions: 12,
      completedQuestions: 12,
    },
    'Operational Readiness': {
      score: 72,
      maxScore: 100,
      percentage: 72,
      level: 'developing',
      questions: 10,
      completedQuestions: 10,
    },
    'Security & Compliance': {
      score: 76,
      maxScore: 100,
      percentage: 76,
      level: 'proficient',
      questions: 8,
      completedQuestions: 8,
    },
  },
  
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
      priority: 'high',
      category: 'Technical Infrastructure',
      title: 'Implement AI Model Deployment Pipeline',
      description: 'Establish a robust pipeline for deploying and managing AI models in production',
      estimatedEffort: '4-6 weeks',
      expectedImpact: 'High - Enables rapid agent deployment',
    },
    {
      priority: 'medium',
      category: 'Security',
      title: 'Update Security Policies for AI Workloads',
      description: 'Revise security policies to address AI-specific risks and compliance requirements',
      estimatedEffort: '2-3 weeks',
      expectedImpact: 'Medium - Ensures secure agent operations',
    },
  ],
  
  industryBenchmark: {
    industry: 'Technology',
    averageScore: 72,
    percentile: 65,
    comparison: 'above',
  },
};

const mockCustomizations: PDFCustomizations = {
  includeExecutiveSummary: true,
  includeDetailedScoring: true,
  includeRecommendations: true,
  includeActionPlan: true,
  includeBenchmarks: true,
  includeAppendix: false,
  template: 'standard',
  brandColor: '#3b82f6',
  companyName: 'Test Organization Inc.',
};

/**
 * Test PDF generation without storage (in-memory only)
 */
export async function testPDFGeneration(): Promise<void> {
  console.log('🔬 Testing PDF Generation Service...');
  
  const pdfService = new PDFGenerationService();
  
  try {
    await pdfService.initialize();
    console.log('✅ PDF Service initialized successfully');
    
    const template = reportTemplateService.getDefaultTemplate();
    console.log('✅ Template loaded successfully');
    
    const pdfBuffer = await pdfService.generateReport(
      mockReportData,
      template,
      mockCustomizations
    );
    
    console.log(`✅ PDF generated successfully: ${pdfBuffer.length} bytes`);
    
    return Promise.resolve();
    
  } catch (error) {
    console.error('❌ PDF generation failed:', error);
    throw error;
  } finally {
    await pdfService.cleanup();
    console.log('✅ PDF Service cleaned up');
  }
}

/**
 * Test storage service (requires environment variables)
 */
export async function testStorageService(): Promise<void> {
  console.log('🔬 Testing Storage Service...');
  
  // Check if storage is configured
  const config = {
    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    bucket: process.env.CLOUDFLARE_R2_BUCKET,
  };
  
  if (!config.endpoint || !config.accessKeyId || !config.secretAccessKey || !config.bucket) {
    console.log('⚠️ Storage service not configured (missing environment variables)');
    console.log('Set CLOUDFLARE_R2_* environment variables to test storage');
    return;
  }
  
  try {
    storage.initialize(config);
    console.log('✅ Storage service initialized');
    
    // Test with a small buffer
    const testBuffer = Buffer.from('Test PDF content', 'utf8');
    const filename = `test-report-${Date.now()}.pdf`;
    
    const storageInfo = await storage.uploadFile(testBuffer, filename, {
      sessionId: 'test-session',
      userId: 'test-user',
      jobId: 'test-job',
      contentType: 'application/pdf',
    });
    
    console.log('✅ File uploaded successfully:', storageInfo.key);
    
    // Test signed URL generation
    const signedUrl = await storage.getSignedUrl(storageInfo.key, 3600);
    console.log('✅ Signed URL generated:', signedUrl.substring(0, 50) + '...');
    
    // Test file deletion
    const deleted = await storage.deleteFile(storageInfo.key);
    console.log('✅ File deleted:', deleted);
    
  } catch (error) {
    console.error('❌ Storage service test failed:', error);
    throw error;
  }
}

/**
 * Test complete PDF generation workflow
 */
export async function testCompleteWorkflow(): Promise<void> {
  console.log('🔬 Testing Complete PDF Generation Workflow...');
  
  try {
    // Test PDF generation
    await testPDFGeneration();
    
    // Test storage (if configured)
    await testStorageService();
    
    console.log('🎉 All tests passed! Task 2.3 PDF Generation Service is working correctly.');
    
  } catch (error) {
    console.error('❌ Workflow test failed:', error);
    throw error;
  }
}

// Export for use in other test files
export { mockReportData, mockCustomizations };

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testCompleteWorkflow()
    .then(() => console.log('✅ Test completed successfully'))
    .catch((error) => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}