// Observability Integration - Task 3.4: Monitoring Setup
// Unified observability interface for ARA system

// Export all observability components
export * from './telemetry';
export * from './logger';
export * from './errorTracking';
export * from './metrics';
export * from './healthChecks';

// Re-export commonly used types and functions
export {
  initializeTelemetry,
  shutdownTelemetry,
  withSpan,
  traceDbOperation,
  traceExternalCall,
  traceUserSession,
  traceWizardStep,
  traceAIInteraction,
} from './telemetry';

export {
  createLogger,
  logger,
  Logger,
  LogLevel,
  LogContext,
} from './logger';

export {
  trackError,
  errorTracker,
  ErrorCategory,
  ErrorSeverity,
} from './errorTracking';

export {
  metrics,
  createTimer,
  measureTime,
  dbMetrics,
  httpMetrics,
  cacheMetrics,
  businessMetrics,
  MetricType,
} from './metrics';

export {
  healthManager,
  handleHealthCheck,
  handleReadinessCheck,
  handleLivenessCheck,
  HealthStatus,
} from './healthChecks';

/**
 * Initialize all observability components
 */
export function initializeObservability() {
  // Telemetry is already initialized in its module
  console.log('🔍 Observability system initialized');
  
  // Log startup
  logger.info('ARA system starting up', {
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    node_version: process.version,
  });
}

/**
 * Graceful shutdown of observability components
 */
export async function shutdownObservability() {
  try {
    await shutdownTelemetry();
    console.log('🔍 Observability system shut down');
  } catch (error) {
    console.error('Error shutting down observability:', error);
  }
}

// Initialize on import (if not in test environment)
if (process.env.NODE_ENV !== 'test') {
  initializeObservability();
}