// Monitoring Middleware - Task 3.4: Monitoring Setup
// Automatic monitoring integration for all requests

import {
  logger,
  httpMetrics,
  createTracingMiddleware,
  createLoggingMiddleware,
  createErrorTrackingMiddleware,
  trackError,
  ErrorCategory,
} from '@/lib/observability';

/**
 * Combined monitoring middleware that includes:
 * - Request/response logging
 * - Performance metrics
 * - Distributed tracing
 * - Error tracking
 */
export function createMonitoringMiddleware() {
  const tracingMiddleware = createTracingMiddleware();
  const loggingMiddleware = createLoggingMiddleware();
  const errorTrackingMiddleware = createErrorTrackingMiddleware();

  return async (request: Request, next: () => Promise<Response>): Promise<Response> => {
    const startTime = Date.now();
    const method = request.method;
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Generate request ID
    const requestId = crypto.randomUUID();
    
    // Add request ID to headers for downstream services
    const enhancedRequest = new Request(request, {
      headers: {
        ...Object.fromEntries(request.headers.entries()),
        'x-request-id': requestId,
      },
    });

    try {
      // Apply tracing middleware
      const response = await tracingMiddleware(enhancedRequest, async () => {
        // Apply logging middleware
        return await loggingMiddleware(enhancedRequest, async () => {
          // Execute the actual handler
          return await next();
        });
      });

      const duration = Date.now() - startTime;
      const status = response.status;

      // Record HTTP metrics
      httpMetrics.recordRequest(method, path, status, duration);

      // Add monitoring headers to response
      const monitoredResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(response.headers.entries()),
          'x-request-id': requestId,
          'x-response-time': duration.toString(),
        },
      });

      return monitoredResponse;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Track the error
      await errorTrackingMiddleware(error as Error, enhancedRequest);

      // Record error metrics
      httpMetrics.recordError(method, path, (error as Error).name);

      // Re-throw the error for handling by the application error handler
      throw error;
    }
  };
}

/**
 * API-specific monitoring middleware with enhanced context
 */
export function createApiMonitoringMiddleware() {
  const baseMiddleware = createMonitoringMiddleware();
  
  return async (request: Request, next: () => Promise<Response>): Promise<Response> => {
    // Extract API-specific context
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const apiVersion = pathSegments[1]; // e.g., 'v1' from '/api/v1/...'
    const endpoint = pathSegments.slice(2).join('/'); // e.g., 'wizard/save-answer'
    
    // Create API-specific logger
    const apiLogger = logger.child({
      component: 'api',
      apiVersion,
      endpoint,
    });

    try {
      return await baseMiddleware(request, next);
    } catch (error) {
      // Enhanced API error logging
      apiLogger.error('API request failed', error instanceof Error ? error : new Error(String(error)), {
        method: request.method,
        path: url.pathname,
        userAgent: request.headers.get('user-agent'),
        contentType: request.headers.get('content-type'),
      });

      throw error;
    }
  };
}

/**
 * WebSocket monitoring wrapper
 */
export function monitorWebSocket(ws: WebSocket, context: { userId?: string; sessionId?: string }) {
  const wsLogger = logger.child({
    component: 'websocket',
    userId: context.userId,
    sessionId: context.sessionId,
  });

  // Monitor connection events
  ws.addEventListener('open', () => {
    wsLogger.info('WebSocket connection opened');
    httpMetrics.recordRequest('WEBSOCKET', '/ws', 101, 0); // 101 = Switching Protocols
  });

  ws.addEventListener('close', (event) => {
    wsLogger.info('WebSocket connection closed', {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
    });
  });

  ws.addEventListener('error', (event) => {
    wsLogger.error('WebSocket error', new Error('WebSocket error'), {
      event: event.type,
    });
    
    trackError(new Error('WebSocket error'), ErrorCategory.SYSTEM, {
      component: 'websocket',
      userId: context.userId,
      sessionId: context.sessionId,
    });
  });

  ws.addEventListener('message', (event) => {
    wsLogger.debug('WebSocket message received', {
      messageSize: event.data?.length || 0,
    });
  });

  return ws;
}

/**
 * Database operation monitoring wrapper
 */
export function monitorDatabaseOperation<T>(
  operation: string,
  table: string,
  fn: () => Promise<T>
): Promise<T> {
  const dbLogger = logger.child({
    component: 'database',
    operation,
    table,
  });

  return dbLogger.time(`db.${operation}.${table}`, fn, {
    operation,
    table,
  });
}

/**
 * External API call monitoring wrapper
 */
export function monitorExternalApiCall<T>(
  service: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const apiLogger = logger.child({
    component: 'external-api',
    service,
    operation,
  });

  return apiLogger.time(`external.${service}.${operation}`, fn, {
    service,
    operation,
  });
}

/**
 * AI interaction monitoring wrapper
 */
export function monitorAIInteraction<T>(
  model: string,
  operation: string,
  fn: () => Promise<T>
): Promise<{ result: T; tokens?: number; duration: number }> {
  const aiLogger = logger.child({
    component: 'ai',
    model,
    operation,
  });

  return aiLogger.time(`ai.${operation}`, async () => {
    const result = await fn();
    
    // Extract token usage if available
    let tokens = 0;
    if (typeof result === 'object' && result !== null && 'usage' in result) {
      tokens = (result as any).usage?.total_tokens || 0;
    }

    // Log AI interaction
    aiLogger.logAIInteraction(model, operation, tokens, 0, true);

    return { result, tokens, duration: 0 };
  }, {
    model,
    operation,
  });
}

/**
 * Business operation monitoring wrapper
 */
export function monitorBusinessOperation<T>(
  operation: string,
  context: {
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, any>;
  },
  fn: () => Promise<T>
): Promise<T> {
  const businessLogger = logger.child({
    component: 'business',
    operation,
    userId: context.userId,
    sessionId: context.sessionId,
  });

  return businessLogger.time(`business.${operation}`, fn, {
    operation,
    ...context.metadata,
  });
}

/**
 * Cache operation monitoring wrapper
 */
export function monitorCacheOperation<T>(
  operation: 'get' | 'set' | 'del' | 'exists',
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  const cacheLogger = logger.child({
    component: 'cache',
    operation,
    key: key.length > 50 ? key.substring(0, 50) + '...' : key,
  });

  return cacheLogger.time(`cache.${operation}`, fn, {
    operation,
    key,
  });
}

/**
 * File operation monitoring wrapper
 */
export function monitorFileOperation<T>(
  operation: 'read' | 'write' | 'delete' | 'upload',
  filename: string,
  fn: () => Promise<T>
): Promise<T> {
  const fileLogger = logger.child({
    component: 'file',
    operation,
    filename,
  });

  return fileLogger.time(`file.${operation}`, fn, {
    operation,
    filename,
  });
}