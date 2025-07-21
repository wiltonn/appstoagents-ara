// Error Tracking and Alerting - Task 3.4: Monitoring Setup
// Comprehensive error tracking with automatic alerting and context preservation

import { logger, LogLevel } from './logger';
import { addSpanEvent, addSpanAttributes } from './telemetry';

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Error categories for classification
export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  DATABASE = 'database',
  EXTERNAL_API = 'external_api',
  BUSINESS_LOGIC = 'business_logic',
  SYSTEM = 'system',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  UI = 'ui',
}

// Error context interface
export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  operation?: string;
  component?: string;
  userAgent?: string;
  ipAddress?: string;
  timestamp: string;
  environment: string;
  version: string;
  [key: string]: any;
}

// Enhanced error interface
export interface TrackedError {
  id: string;
  message: string;
  stack?: string;
  name: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  context: ErrorContext;
  metadata: Record<string, any>;
  fingerprint: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  resolved: boolean;
}

// Alert configuration
export interface AlertConfig {
  enabled: boolean;
  webhookUrl?: string;
  emailEndpoint?: string;
  slackWebhook?: string;
  discordWebhook?: string;
  severityThreshold: ErrorSeverity;
  rateLimitMinutes: number;
}

// Default alert configuration
const defaultAlertConfig: AlertConfig = {
  enabled: process.env.NODE_ENV === 'production',
  webhookUrl: process.env.ERROR_WEBHOOK_URL,
  emailEndpoint: process.env.ERROR_EMAIL_ENDPOINT,
  slackWebhook: process.env.SLACK_ERROR_WEBHOOK,
  discordWebhook: process.env.DISCORD_ERROR_WEBHOOK,
  severityThreshold: ErrorSeverity.MEDIUM,
  rateLimitMinutes: 5, // Don't send same error alert more than once per 5 minutes
};

/**
 * Error Tracker class for comprehensive error handling and alerting
 */
export class ErrorTracker {
  private alertConfig: AlertConfig;
  private errorCounts: Map<string, { count: number; lastSeen: number }> = new Map();
  private alertCooldowns: Map<string, number> = new Map();

  constructor(config: Partial<AlertConfig> = {}) {
    this.alertConfig = { ...defaultAlertConfig, ...config };
  }

  /**
   * Generate error fingerprint for deduplication
   */
  private generateFingerprint(error: Error, category: ErrorCategory, operation?: string): string {
    const baseFingerprint = `${error.name}:${category}:${operation || 'unknown'}`;
    
    // Use first few lines of stack trace for more specific fingerprinting
    const stackLines = error.stack?.split('\n').slice(0, 3).join('\n') || '';
    const stackHash = this.simpleHash(stackLines);
    
    return `${baseFingerprint}:${stackHash}`;
  }

  /**
   * Simple hash function for fingerprinting
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Determine error severity based on category and context
   */
  private determineSeverity(
    error: Error,
    category: ErrorCategory,
    context: Partial<ErrorContext> = {}
  ): ErrorSeverity {
    // Critical errors that require immediate attention
    if (
      category === ErrorCategory.SECURITY ||
      category === ErrorCategory.DATABASE ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('timeout') ||
      context.userId && category === ErrorCategory.AUTHENTICATION
    ) {
      return ErrorSeverity.CRITICAL;
    }

    // High severity errors
    if (
      category === ErrorCategory.EXTERNAL_API ||
      category === ErrorCategory.SYSTEM ||
      error.name === 'TypeError' ||
      error.name === 'ReferenceError'
    ) {
      return ErrorSeverity.HIGH;
    }

    // Medium severity errors
    if (
      category === ErrorCategory.BUSINESS_LOGIC ||
      category === ErrorCategory.AUTHORIZATION ||
      category === ErrorCategory.PERFORMANCE
    ) {
      return ErrorSeverity.MEDIUM;
    }

    // Low severity errors
    return ErrorSeverity.LOW;
  }

  /**
   * Create error context from available information
   */
  private createErrorContext(context: Partial<ErrorContext> = {}): ErrorContext {
    return {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      version: process.env.npm_package_version || '1.0.0',
      ...context,
    };
  }

  /**
   * Track and process error
   */
  async trackError(
    error: Error,
    category: ErrorCategory,
    context: Partial<ErrorContext> = {},
    metadata: Record<string, any> = {}
  ): Promise<TrackedError> {
    const errorContext = this.createErrorContext(context);
    const severity = this.determineSeverity(error, category, errorContext);
    const fingerprint = this.generateFingerprint(error, category, context.operation);
    const errorId = crypto.randomUUID();

    // Update error count
    const existing = this.errorCounts.get(fingerprint);
    const count = existing ? existing.count + 1 : 1;
    this.errorCounts.set(fingerprint, { count, lastSeen: Date.now() });

    // Create tracked error
    const trackedError: TrackedError = {
      id: errorId,
      message: error.message,
      stack: error.stack,
      name: error.name,
      category,
      severity,
      context: errorContext,
      metadata,
      fingerprint,
      count,
      firstSeen: existing ? new Date(existing.lastSeen).toISOString() : errorContext.timestamp,
      lastSeen: errorContext.timestamp,
      resolved: false,
    };

    // Log the error
    logger.error(`${category} error occurred`, error, {
      errorId,
      category,
      severity,
      fingerprint,
      count,
      ...metadata,
    });

    // Add to tracing
    addSpanEvent('error.tracked', {
      'error.id': errorId,
      'error.category': category,
      'error.severity': severity,
      'error.fingerprint': fingerprint,
      'error.count': count,
    });

    addSpanAttributes({
      'error.tracked': true,
      'error.category': category,
      'error.severity': severity,
    });

    // Send alert if necessary
    if (this.shouldSendAlert(severity, fingerprint)) {
      await this.sendAlert(trackedError);
    }

    return trackedError;
  }

  /**
   * Check if alert should be sent based on severity and rate limiting
   */
  private shouldSendAlert(severity: ErrorSeverity, fingerprint: string): boolean {
    if (!this.alertConfig.enabled) {
      return false;
    }

    // Check severity threshold
    const severityOrder = [ErrorSeverity.LOW, ErrorSeverity.MEDIUM, ErrorSeverity.HIGH, ErrorSeverity.CRITICAL];
    const currentSeverityIndex = severityOrder.indexOf(severity);
    const thresholdIndex = severityOrder.indexOf(this.alertConfig.severityThreshold);
    
    if (currentSeverityIndex < thresholdIndex) {
      return false;
    }

    // Check rate limiting
    const lastAlert = this.alertCooldowns.get(fingerprint);
    const now = Date.now();
    const cooldownMs = this.alertConfig.rateLimitMinutes * 60 * 1000;
    
    if (lastAlert && (now - lastAlert) < cooldownMs) {
      return false;
    }

    this.alertCooldowns.set(fingerprint, now);
    return true;
  }

  /**
   * Send alert notifications
   */
  private async sendAlert(error: TrackedError): Promise<void> {
    const alertPayload = {
      error: {
        id: error.id,
        message: error.message,
        category: error.category,
        severity: error.severity,
        count: error.count,
        environment: error.context.environment,
        timestamp: error.context.timestamp,
      },
      context: error.context,
      metadata: error.metadata,
    };

    const promises: Promise<void>[] = [];

    // Webhook alert
    if (this.alertConfig.webhookUrl) {
      promises.push(this.sendWebhookAlert(this.alertConfig.webhookUrl, alertPayload));
    }

    // Slack alert
    if (this.alertConfig.slackWebhook) {
      promises.push(this.sendSlackAlert(this.alertConfig.slackWebhook, error));
    }

    // Discord alert
    if (this.alertConfig.discordWebhook) {
      promises.push(this.sendDiscordAlert(this.alertConfig.discordWebhook, error));
    }

    // Email alert
    if (this.alertConfig.emailEndpoint) {
      promises.push(this.sendEmailAlert(this.alertConfig.emailEndpoint, error));
    }

    // Execute all alerts concurrently
    try {
      await Promise.allSettled(promises);
      logger.info('Error alerts sent', { errorId: error.id, alertCount: promises.length });
    } catch (alertError) {
      logger.error('Failed to send error alerts', alertError instanceof Error ? alertError : new Error(String(alertError)), {
        errorId: error.id,
      });
    }
  }

  /**
   * Send generic webhook alert
   */
  private async sendWebhookAlert(url: string, payload: any): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook alert failed: ${response.status}`);
      }
    } catch (error) {
      logger.error('Webhook alert failed', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(webhookUrl: string, error: TrackedError): Promise<void> {
    const severityEmoji = {
      [ErrorSeverity.LOW]: '🟢',
      [ErrorSeverity.MEDIUM]: '🟡',
      [ErrorSeverity.HIGH]: '🟠',
      [ErrorSeverity.CRITICAL]: '🔴',
    };

    const payload = {
      text: `${severityEmoji[error.severity]} Error Alert`,
      attachments: [
        {
          color: error.severity === ErrorSeverity.CRITICAL ? 'danger' : 
                error.severity === ErrorSeverity.HIGH ? 'warning' : 'good',
          fields: [
            {
              title: 'Error Message',
              value: error.message,
              short: false,
            },
            {
              title: 'Category',
              value: error.category,
              short: true,
            },
            {
              title: 'Severity',
              value: error.severity.toUpperCase(),
              short: true,
            },
            {
              title: 'Environment',
              value: error.context.environment,
              short: true,
            },
            {
              title: 'Count',
              value: error.count.toString(),
              short: true,
            },
          ],
          timestamp: Math.floor(new Date(error.context.timestamp).getTime() / 1000),
        },
      ],
    };

    await this.sendWebhookAlert(webhookUrl, payload);
  }

  /**
   * Send Discord alert
   */
  private async sendDiscordAlert(webhookUrl: string, error: TrackedError): Promise<void> {
    const severityColor = {
      [ErrorSeverity.LOW]: 0x00ff00,
      [ErrorSeverity.MEDIUM]: 0xffff00,
      [ErrorSeverity.HIGH]: 0xff8800,
      [ErrorSeverity.CRITICAL]: 0xff0000,
    };

    const payload = {
      embeds: [
        {
          title: '🚨 Error Alert',
          description: error.message,
          color: severityColor[error.severity],
          fields: [
            {
              name: 'Category',
              value: error.category,
              inline: true,
            },
            {
              name: 'Severity',
              value: error.severity.toUpperCase(),
              inline: true,
            },
            {
              name: 'Environment',
              value: error.context.environment,
              inline: true,
            },
            {
              name: 'Count',
              value: error.count.toString(),
              inline: true,
            },
          ],
          timestamp: error.context.timestamp,
        },
      ],
    };

    await this.sendWebhookAlert(webhookUrl, payload);
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(endpoint: string, error: TrackedError): Promise<void> {
    const payload = {
      to: process.env.ERROR_ALERT_EMAIL,
      subject: `[${error.severity.toUpperCase()}] ARA Error Alert: ${error.category}`,
      html: `
        <h2>Error Alert</h2>
        <p><strong>Message:</strong> ${error.message}</p>
        <p><strong>Category:</strong> ${error.category}</p>
        <p><strong>Severity:</strong> ${error.severity.toUpperCase()}</p>
        <p><strong>Environment:</strong> ${error.context.environment}</p>
        <p><strong>Count:</strong> ${error.count}</p>
        <p><strong>Timestamp:</strong> ${error.context.timestamp}</p>
        
        ${error.context.userId ? `<p><strong>User ID:</strong> ${error.context.userId}</p>` : ''}
        ${error.context.operation ? `<p><strong>Operation:</strong> ${error.context.operation}</p>` : ''}
        
        ${error.stack ? `<h3>Stack Trace</h3><pre>${error.stack}</pre>` : ''}
        
        <h3>Context</h3>
        <pre>${JSON.stringify(error.context, null, 2)}</pre>
        
        <h3>Metadata</h3>
        <pre>${JSON.stringify(error.metadata, null, 2)}</pre>
      `,
    };

    await this.sendWebhookAlert(endpoint, payload);
  }

  /**
   * Get error statistics
   */
  getErrorStats(): { totalErrors: number; uniqueErrors: number; recentErrors: number } {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    let totalErrors = 0;
    let recentErrors = 0;
    
    for (const [fingerprint, data] of this.errorCounts.entries()) {
      totalErrors += data.count;
      if (data.lastSeen > oneHourAgo) {
        recentErrors += data.count;
      }
    }

    return {
      totalErrors,
      uniqueErrors: this.errorCounts.size,
      recentErrors,
    };
  }

  /**
   * Clear old error counts (cleanup)
   */
  cleanup(olderThanHours: number = 24): void {
    const cutoff = Date.now() - (olderThanHours * 60 * 60 * 1000);
    
    for (const [fingerprint, data] of this.errorCounts.entries()) {
      if (data.lastSeen < cutoff) {
        this.errorCounts.delete(fingerprint);
      }
    }

    for (const [fingerprint, timestamp] of this.alertCooldowns.entries()) {
      if (timestamp < cutoff) {
        this.alertCooldowns.delete(fingerprint);
      }
    }
  }
}

// Global error tracker instance
export const errorTracker = new ErrorTracker();

/**
 * Convenience function to track errors with automatic categorization
 */
export async function trackError(
  error: Error,
  category: ErrorCategory,
  context: Partial<ErrorContext> = {},
  metadata: Record<string, any> = {}
): Promise<TrackedError> {
  return await errorTracker.trackError(error, category, context, metadata);
}

/**
 * Express/API middleware for automatic error tracking
 */
export function createErrorTrackingMiddleware() {
  return async (error: Error, request: Request): Promise<Response> => {
    // Determine category based on error type and context
    let category = ErrorCategory.SYSTEM;
    
    if (error.message.includes('auth')) {
      category = ErrorCategory.AUTHENTICATION;
    } else if (error.message.includes('permission') || error.message.includes('forbidden')) {
      category = ErrorCategory.AUTHORIZATION;
    } else if (error.message.includes('validation') || error.message.includes('invalid')) {
      category = ErrorCategory.VALIDATION;
    } else if (error.message.includes('database') || error.message.includes('prisma')) {
      category = ErrorCategory.DATABASE;
    }

    // Extract context from request
    const context: Partial<ErrorContext> = {
      requestId: request.headers.get('x-request-id') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      operation: `${request.method} ${new URL(request.url).pathname}`,
      component: 'api',
    };

    // Track the error
    await trackError(error, category, context, {
      method: request.method,
      path: new URL(request.url).pathname,
      headers: Object.fromEntries(request.headers.entries()),
    });

    // Return error response
    const status = error.name === 'ValidationError' ? 400 :
                  error.name === 'AuthenticationError' ? 401 :
                  error.name === 'AuthorizationError' ? 403 : 500;

    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' ? 
        'An error occurred while processing your request' : 
        error.message,
    }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

// Cleanup old errors every hour
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    errorTracker.cleanup();
  }, 60 * 60 * 1000); // Every hour
}