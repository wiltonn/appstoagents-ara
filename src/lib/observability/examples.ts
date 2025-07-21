// Monitoring Integration Examples - Task 3.4: Monitoring Setup
// Examples of how to integrate monitoring throughout the application

import {
  logger,
  trackError,
  metrics,
  withSpan,
  traceUserSession,
  traceWizardStep,
  traceAIInteraction,
  ErrorCategory,
  businessMetrics,
  httpMetrics,
  dbMetrics,
  cacheMetrics,
} from './index';

import {
  monitorDatabaseOperation,
  monitorExternalApiCall,
  monitorAIInteraction,
  monitorBusinessOperation,
  monitorCacheOperation,
} from '@/middleware/monitoring';

/**
 * Example: Wizard Step Processing with Complete Monitoring
 */
export async function processWizardStepExample(
  userId: string | null,
  sessionId: string,
  step: number,
  data: any
) {
  // Create scoped logger
  const stepLogger = logger.child({
    userId,
    sessionId,
    step,
    component: 'wizard',
  });

  return await withSpan('wizard.process_step', async (span) => {
    // Add user context to trace
    traceUserSession(userId, sessionId, !userId);
    traceWizardStep(step, 5, `step_${step}`);

    stepLogger.info('Processing wizard step', { step, dataKeys: Object.keys(data) });

    try {
      // Monitor database operation
      const result = await monitorDatabaseOperation('update', 'audit_sessions', async () => {
        // Simulated database update
        return { success: true, stepCompleted: step };
      });

      // Record business metrics
      businessMetrics.recordWizardCompletion(userId, step, Date.now());

      // Monitor cache operation
      await monitorCacheOperation('set', `wizard:${sessionId}:step:${step}`, async () => {
        // Simulated cache update
        return true;
      });

      stepLogger.info('Wizard step processed successfully', { 
        step, 
        result: result.success 
      });

      return result;
    } catch (error) {
      // Track error with context
      await trackError(error as Error, ErrorCategory.BUSINESS_LOGIC, {
        userId,
        sessionId,
        operation: 'process_wizard_step',
        step,
      }, { data });

      stepLogger.error('Failed to process wizard step', error as Error, { step });
      throw error;
    }
  });
}

/**
 * Example: AI Chat Interaction with Monitoring
 */
export async function processChatMessageExample(
  message: string,
  userId: string | null,
  sessionId: string
) {
  const chatLogger = logger.child({
    userId,
    sessionId,
    component: 'chat',
  });

  return await withSpan('chat.process_message', async (span) => {
    traceUserSession(userId, sessionId, !userId);
    
    chatLogger.info('Processing chat message', { 
      messageLength: message.length,
      userId: userId ? 'authenticated' : 'guest',
    });

    try {
      // Monitor AI interaction
      const { result, tokens, duration } = await monitorAIInteraction(
        'gpt-4o-mini',
        'chat_completion',
        async () => {
          // Simulated OpenAI call
          await new Promise(resolve => setTimeout(resolve, 1000));
          return {
            choices: [{ message: { content: 'AI response here' } }],
            usage: { total_tokens: 150 },
          };
        }
      );

      // Add AI context to trace
      traceAIInteraction('gpt-4o-mini', tokens || 0, duration);

      // Record business metrics
      businessMetrics.recordChatInteraction(userId, tokens || 0, duration);

      chatLogger.logAIInteraction('gpt-4o-mini', 'completion', tokens || 0, duration, true);

      return result;
    } catch (error) {
      await trackError(error as Error, ErrorCategory.EXTERNAL_API, {
        userId,
        sessionId,
        operation: 'chat_completion',
        component: 'openai',
      }, { messageLength: message.length });

      throw error;
    }
  });
}

/**
 * Example: Report Generation with Performance Monitoring
 */
export async function generateReportExample(
  auditData: any,
  format: 'pdf' | 'markdown',
  userId: string | null
) {
  const reportLogger = logger.child({
    userId,
    format,
    component: 'reports',
  });

  return await monitorBusinessOperation(
    'generate_report',
    { userId, metadata: { format } },
    async () => {
      reportLogger.info('Starting report generation', { format });

      try {
        let reportContent: string;
        let duration: number;

        if (format === 'pdf') {
          // Monitor PDF generation
          const timer = Date.now();
          reportContent = await monitorExternalApiCall('puppeteer', 'pdf_generation', async () => {
            // Simulated PDF generation
            await new Promise(resolve => setTimeout(resolve, 2000));
            return 'PDF content here';
          });
          duration = Date.now() - timer;
        } else {
          // Monitor Markdown generation
          const timer = Date.now();
          reportContent = 'Markdown content here';
          duration = Date.now() - timer;
        }

        // Record business metrics
        businessMetrics.recordReportGeneration(format, duration, true);

        reportLogger.info('Report generated successfully', { 
          format, 
          duration,
          contentLength: reportContent.length,
        });

        return {
          content: reportContent,
          format,
          generatedAt: new Date().toISOString(),
          duration,
        };
      } catch (error) {
        await trackError(error as Error, ErrorCategory.BUSINESS_LOGIC, {
          userId,
          operation: 'generate_report',
          component: 'reports',
        }, { format });

        // Record failed generation
        businessMetrics.recordReportGeneration(format, 0, false);

        throw error;
      }
    }
  );
}

/**
 * Example: API Endpoint with Comprehensive Monitoring
 */
export async function apiEndpointExample(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;
  const startTime = Date.now();

  const apiLogger = logger.child({
    method,
    path,
    component: 'api',
    requestId: request.headers.get('x-request-id'),
  });

  try {
    apiLogger.info('API request started', {
      userAgent: request.headers.get('user-agent'),
      contentType: request.headers.get('content-type'),
    });

    // Process request
    const result = await withSpan(`api.${method}.${path}`, async (span) => {
      // Simulated API processing
      await new Promise(resolve => setTimeout(resolve, 100));
      return { success: true, data: 'API response' };
    });

    const duration = Date.now() - startTime;
    const status = 200;

    // Record metrics
    httpMetrics.recordRequest(method, path, status, duration);

    apiLogger.logRequest(method, path, status, duration);

    return new Response(JSON.stringify(result), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'x-response-time': duration.toString(),
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const status = 500;

    // Track error
    await trackError(error as Error, ErrorCategory.SYSTEM, {
      requestId: request.headers.get('x-request-id') || undefined,
      operation: `${method} ${path}`,
      component: 'api',
    }, {
      method,
      path,
      userAgent: request.headers.get('user-agent'),
    });

    // Record error metrics
    httpMetrics.recordError(method, path, (error as Error).name);

    apiLogger.logRequest(method, path, status, duration);

    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'An error occurred',
    }), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'x-response-time': duration.toString(),
      },
    });
  }
}

/**
 * Example: Database Connection Pool Monitoring
 */
export async function monitorDatabasePool() {
  // This would integrate with your actual database pool
  const poolLogger = logger.child({ component: 'database_pool' });

  try {
    // Monitor connection pool stats
    const poolStats = {
      active: 5,
      idle: 3,
      total: 8,
      waiting: 0,
    };

    // Record connection metrics
    dbMetrics.recordConnection('main', poolStats.active, poolStats.idle);

    poolLogger.debug('Database pool status', poolStats);

    // Check for connection leaks
    if (poolStats.active > poolStats.total * 0.8) {
      poolLogger.warn('High database connection usage', poolStats);
      
      metrics.record('db_connection_usage_high', 1, 'counter', 'count', {
        pool: 'main',
        usage_percent: ((poolStats.active / poolStats.total) * 100).toString(),
      });
    }
  } catch (error) {
    poolLogger.error('Failed to monitor database pool', error as Error);
  }
}

/**
 * Example: Cache Performance Monitoring
 */
export async function monitorCachePerformance() {
  const cacheLogger = logger.child({ component: 'cache_monitor' });

  try {
    // Simulated cache statistics
    const cacheStats = {
      hits: 850,
      misses: 150,
      sets: 200,
      deletes: 50,
      errors: 2,
    };

    const hitRatio = (cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100;

    // Record cache metrics
    cacheMetrics.recordHitRatio('redis', hitRatio);

    cacheLogger.info('Cache performance stats', {
      ...cacheStats,
      hitRatio: hitRatio.toFixed(2) + '%',
    });

    // Alert on low hit ratio
    if (hitRatio < 80) {
      cacheLogger.warn('Low cache hit ratio detected', {
        hitRatio: hitRatio.toFixed(2) + '%',
        threshold: '80%',
      });
    }
  } catch (error) {
    cacheLogger.error('Failed to monitor cache performance', error as Error);
  }
}

/**
 * Example: System Health Monitoring
 */
export async function monitorSystemHealth() {
  const systemLogger = logger.child({ component: 'system_monitor' });

  try {
    // Memory usage monitoring
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
      
      systemLogger.logPerformanceMetric('memory_heap_used', heapUsedMB, 'MB');
      systemLogger.logPerformanceMetric('memory_heap_total', heapTotalMB, 'MB');

      // Alert on high memory usage
      if (heapUsedMB > 400) { // 400MB threshold
        systemLogger.warn('High memory usage detected', {
          heapUsedMB: heapUsedMB.toFixed(2),
          heapTotalMB: heapTotalMB.toFixed(2),
        });
      }
    }

    // Process uptime monitoring
    if (typeof process !== 'undefined' && process.uptime) {
      const uptimeSeconds = process.uptime();
      systemLogger.logPerformanceMetric('process_uptime', uptimeSeconds, 'seconds');
    }

    systemLogger.debug('System health check completed');
  } catch (error) {
    systemLogger.error('System health monitoring failed', error as Error);
  }
}

/**
 * Example: Custom Business Metric Tracking
 */
export function trackCustomBusinessMetrics(
  eventType: string,
  userId: string | null,
  metadata: Record<string, any> = {}
) {
  const eventLogger = logger.child({
    component: 'business_metrics',
    eventType,
    userId,
  });

  // Log business event
  eventLogger.logUserAction(eventType, userId || 'anonymous', true, metadata);

  // Record custom metrics
  metrics.record(`business.${eventType}`, 1, 'counter', 'count', {
    user_type: userId ? 'authenticated' : 'guest',
    ...metadata,
  });

  eventLogger.info('Business event tracked', { eventType, metadata });
}

// Export all examples for documentation and testing
export const monitoringExamples = {
  processWizardStepExample,
  processChatMessageExample,
  generateReportExample,
  apiEndpointExample,
  monitorDatabasePool,
  monitorCachePerformance,
  monitorSystemHealth,
  trackCustomBusinessMetrics,
};