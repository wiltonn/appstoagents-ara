// OpenTelemetry Integration - Task 3.4: Monitoring Setup
// Distributed tracing and observability for ARA system

import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrismaInstrumentation } from '@prisma/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';

// Service configuration
const SERVICE_NAME = 'ara-assessment-system';
const SERVICE_VERSION = process.env.npm_package_version || '1.0.0';
const ENVIRONMENT = process.env.NODE_ENV || 'development';

// Telemetry configuration
export interface TelemetryConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  endpoint?: string;
  sampleRate: number;
  enableConsoleExporter: boolean;
}

const defaultConfig: TelemetryConfig = {
  serviceName: SERVICE_NAME,
  serviceVersion: SERVICE_VERSION,
  environment: ENVIRONMENT,
  endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  sampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
  enableConsoleExporter: ENVIRONMENT !== 'production',
};

// OpenTelemetry SDK instance
let sdkInstance: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry with custom configuration
 */
export function initializeTelemetry(config: Partial<TelemetryConfig> = {}) {
  const finalConfig = { ...defaultConfig, ...config };

  // Create resource with service information
  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: finalConfig.serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: finalConfig.serviceVersion,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: finalConfig.environment,
    [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'ara',
    [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: process.env.VERCEL_DEPLOYMENT_ID || 'local',
  });

  // Configure exporters
  const exporters = [];
  
  if (finalConfig.endpoint) {
    exporters.push(
      new OTLPTraceExporter({
        url: finalConfig.endpoint,
        headers: {
          'Authorization': `Bearer ${process.env.OTEL_API_KEY}`,
        },
      })
    );
  }

  // Configure instrumentations
  const instrumentations = [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false, // Disable filesystem instrumentation to reduce noise
      },
    }),
    new PrismaInstrumentation(),
    new HttpInstrumentation({
      requestHook: (span, request) => {
        // Add custom attributes to HTTP spans
        span.setAttributes({
          'http.user_agent': request.headers['user-agent'] || 'unknown',
          'http.request_id': request.headers['x-request-id'] || 'unknown',
        });
      },
    }),
  ];

  // Initialize SDK
  sdkInstance = new NodeSDK({
    resource,
    traceExporter: exporters.length > 0 ? exporters[0] : undefined,
    instrumentations,
  });

  // Start the SDK
  try {
    sdkInstance.start();
    console.log('🔍 OpenTelemetry initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize OpenTelemetry:', error);
  }

  return sdkInstance;
}

/**
 * Shutdown telemetry gracefully
 */
export async function shutdownTelemetry() {
  if (sdkInstance) {
    try {
      await sdkInstance.shutdown();
      console.log('🔍 OpenTelemetry shut down successfully');
    } catch (error) {
      console.error('❌ Error shutting down OpenTelemetry:', error);
    }
  }
}

/**
 * Get the tracer instance for manual instrumentation
 */
export function getTracer(name: string = SERVICE_NAME) {
  return trace.getTracer(name, SERVICE_VERSION);
}

/**
 * Create a span with automatic error handling and attributes
 */
export async function withSpan<T>(
  name: string,
  operation: (span: any) => Promise<T>,
  attributes: Record<string, string | number | boolean> = {},
  spanKind: SpanKind = SpanKind.INTERNAL
): Promise<T> {
  const tracer = getTracer();
  
  return tracer.startActiveSpan(name, { kind: spanKind, attributes }, async (span) => {
    try {
      const result = await operation(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Add context to current span
 */
export function addSpanAttributes(attributes: Record<string, string | number | boolean>) {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttributes(attributes);
  }
}

/**
 * Add event to current span
 */
export function addSpanEvent(name: string, attributes: Record<string, any> = {}) {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Middleware for automatic request tracing
 */
export function createTracingMiddleware() {
  return async (request: Request, next: () => Promise<Response>): Promise<Response> => {
    const tracer = getTracer();
    
    return tracer.startActiveSpan(
      `${request.method} ${new URL(request.url).pathname}`,
      {
        kind: SpanKind.SERVER,
        attributes: {
          'http.method': request.method,
          'http.url': request.url,
          'http.scheme': new URL(request.url).protocol.slice(0, -1),
          'http.host': new URL(request.url).host,
          'http.target': new URL(request.url).pathname + new URL(request.url).search,
        },
      },
      async (span) => {
        try {
          const response = await next();
          
          span.setAttributes({
            'http.status_code': response.status,
            'http.response.size': response.headers.get('content-length') || 0,
          });
          
          if (response.status >= 400) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: `HTTP ${response.status}`,
            });
          } else {
            span.setStatus({ code: SpanStatusCode.OK });
          }
          
          return response;
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
          throw error;
        } finally {
          span.end();
        }
      }
    );
  };
}

/**
 * Database operation tracing helper
 */
export async function traceDbOperation<T>(
  operation: string,
  table: string,
  fn: () => Promise<T>
): Promise<T> {
  return withSpan(
    `db.${operation}`,
    async (span) => {
      span.setAttributes({
        'db.system': 'postgresql',
        'db.operation': operation,
        'db.sql.table': table,
      });
      
      const startTime = Date.now();
      const result = await fn();
      const duration = Date.now() - startTime;
      
      span.setAttributes({
        'db.duration_ms': duration,
      });
      
      return result;
    },
    {},
    SpanKind.CLIENT
  );
}

/**
 * External API call tracing helper
 */
export async function traceExternalCall<T>(
  service: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  return withSpan(
    `external.${service}.${operation}`,
    async (span) => {
      span.setAttributes({
        'external.service': service,
        'external.operation': operation,
      });
      
      const startTime = Date.now();
      const result = await fn();
      const duration = Date.now() - startTime;
      
      span.setAttributes({
        'external.duration_ms': duration,
      });
      
      return result;
    },
    {},
    SpanKind.CLIENT
  );
}

/**
 * User session tracing helper
 */
export function traceUserSession(userId: string | null, sessionId: string, isGuest: boolean = false) {
  addSpanAttributes({
    'user.id': userId || 'anonymous',
    'user.session_id': sessionId,
    'user.is_guest': isGuest,
  });
}

/**
 * Wizard step tracing helper
 */
export function traceWizardStep(step: number, totalSteps: number, stepName: string) {
  addSpanAttributes({
    'wizard.step': step,
    'wizard.total_steps': totalSteps,
    'wizard.step_name': stepName,
  });
}

/**
 * AI interaction tracing helper
 */
export function traceAIInteraction(model: string, tokens: number, responseTime: number) {
  addSpanAttributes({
    'ai.model': model,
    'ai.tokens_used': tokens,
    'ai.response_time_ms': responseTime,
  });
}

// Initialize telemetry if not in test environment
if (process.env.NODE_ENV !== 'test') {
  initializeTelemetry();
}

// Graceful shutdown
process.on('SIGTERM', shutdownTelemetry);
process.on('SIGINT', shutdownTelemetry);