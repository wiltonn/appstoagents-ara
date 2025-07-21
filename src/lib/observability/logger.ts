// Structured Logging - Task 3.4: Monitoring Setup
// Contextual logging with structured data for debugging and monitoring

import { trace, context } from '@opentelemetry/api';

// Log levels
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

// Log context interface
export interface LogContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
  spanId?: string;
  operation?: string;
  component?: string;
  environment?: string;
  timestamp?: string;
  [key: string]: any;
}

// Structured log entry
export interface LogEntry extends LogContext {
  level: LogLevel;
  message: string;
  error?: Error;
  duration?: number;
  metadata?: Record<string, any>;
}

// Logger configuration
export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableStructured: boolean;
  environment: string;
  serviceName: string;
}

// Default configuration
const defaultConfig: LoggerConfig = {
  level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  enableConsole: true,
  enableStructured: process.env.NODE_ENV === 'production',
  environment: process.env.NODE_ENV || 'development',
  serviceName: 'ara-assessment-system',
};

/**
 * Enhanced Logger class with structured logging and OpenTelemetry integration
 */
export class Logger {
  private config: LoggerConfig;
  private context: LogContext;

  constructor(component: string, config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.context = {
      component,
      environment: this.config.environment,
      serviceName: this.config.serviceName,
    };
  }

  /**
   * Create logger with additional context
   */
  child(additionalContext: Partial<LogContext>): Logger {
    const childLogger = new Logger(this.context.component || 'unknown', this.config);
    childLogger.context = { ...this.context, ...additionalContext };
    return childLogger;
  }

  /**
   * Add context to current logger instance
   */
  withContext(additionalContext: Partial<LogContext>): Logger {
    this.context = { ...this.context, ...additionalContext };
    return this;
  }

  /**
   * Add tracing context from OpenTelemetry
   */
  private addTracingContext(): Partial<LogContext> {
    const span = trace.getActiveSpan();
    if (span) {
      const spanContext = span.spanContext();
      return {
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
      };
    }
    return {};
  }

  /**
   * Create structured log entry
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    metadata: Record<string, any> = {},
    error?: Error,
    duration?: number
  ): LogEntry {
    const timestamp = new Date().toISOString();
    const tracingContext = this.addTracingContext();

    return {
      ...this.context,
      ...tracingContext,
      level,
      message,
      timestamp,
      error,
      duration,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  }

  /**
   * Format log entry for console output
   */
  private formatConsoleLog(entry: LogEntry): string {
    const levelNames = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
    const levelName = levelNames[entry.level];
    const timestamp = entry.timestamp;
    const component = entry.component || 'unknown';
    
    let logString = `[${timestamp}] ${levelName} [${component}] ${entry.message}`;

    if (entry.requestId) {
      logString += ` (req: ${entry.requestId})`;
    }

    if (entry.userId) {
      logString += ` (user: ${entry.userId})`;
    }

    if (entry.duration !== undefined) {
      logString += ` (${entry.duration}ms)`;
    }

    if (entry.metadata) {
      logString += ` ${JSON.stringify(entry.metadata)}`;
    }

    if (entry.error) {
      logString += `\nError: ${entry.error.message}\nStack: ${entry.error.stack}`;
    }

    return logString;
  }

  /**
   * Output log entry
   */
  private output(entry: LogEntry): void {
    // Check log level
    if (entry.level > this.config.level) {
      return;
    }

    // Console logging
    if (this.config.enableConsole) {
      const formattedLog = this.formatConsoleLog(entry);
      
      switch (entry.level) {
        case LogLevel.ERROR:
          console.error(formattedLog);
          break;
        case LogLevel.WARN:
          console.warn(formattedLog);
          break;
        case LogLevel.INFO:
          console.info(formattedLog);
          break;
        case LogLevel.DEBUG:
          console.debug(formattedLog);
          break;
      }
    }

    // Structured logging (for external log aggregators)
    if (this.config.enableStructured) {
      console.log(JSON.stringify(entry));
    }
  }

  /**
   * Log error level message
   */
  error(message: string, error?: Error, metadata: Record<string, any> = {}): void {
    const entry = this.createLogEntry(LogLevel.ERROR, message, metadata, error);
    this.output(entry);
  }

  /**
   * Log warning level message
   */
  warn(message: string, metadata: Record<string, any> = {}): void {
    const entry = this.createLogEntry(LogLevel.WARN, message, metadata);
    this.output(entry);
  }

  /**
   * Log info level message
   */
  info(message: string, metadata: Record<string, any> = {}): void {
    const entry = this.createLogEntry(LogLevel.INFO, message, metadata);
    this.output(entry);
  }

  /**
   * Log debug level message
   */
  debug(message: string, metadata: Record<string, any> = {}): void {
    const entry = this.createLogEntry(LogLevel.DEBUG, message, metadata);
    this.output(entry);
  }

  /**
   * Log with custom level
   */
  log(level: LogLevel, message: string, metadata: Record<string, any> = {}): void {
    const entry = this.createLogEntry(level, message, metadata);
    this.output(entry);
  }

  /**
   * Time a function execution and log the result
   */
  async time<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata: Record<string, any> = {}
  ): Promise<T> {
    const startTime = Date.now();
    
    this.debug(`Starting ${operation}`, metadata);
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      this.info(`Completed ${operation}`, { ...metadata, duration });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.error(
        `Failed ${operation}`,
        error instanceof Error ? error : new Error(String(error)),
        { ...metadata, duration }
      );
      
      throw error;
    }
  }

  /**
   * Log HTTP request
   */
  logRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    metadata: Record<string, any> = {}
  ): void {
    const level = statusCode >= 500 ? LogLevel.ERROR : 
                 statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    
    this.log(level, `${method} ${path} ${statusCode}`, {
      ...metadata,
      method,
      path,
      statusCode,
      duration,
    });
  }

  /**
   * Log database operation
   */
  logDbOperation(
    operation: string,
    table: string,
    duration: number,
    rowsAffected?: number,
    metadata: Record<string, any> = {}
  ): void {
    this.info(`DB ${operation} on ${table}`, {
      ...metadata,
      operation,
      table,
      duration,
      rowsAffected,
    });
  }

  /**
   * Log user action
   */
  logUserAction(
    action: string,
    userId: string,
    success: boolean = true,
    metadata: Record<string, any> = {}
  ): void {
    const level = success ? LogLevel.INFO : LogLevel.WARN;
    
    this.log(level, `User action: ${action}`, {
      ...metadata,
      action,
      userId,
      success,
    });
  }

  /**
   * Log security event
   */
  logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    metadata: Record<string, any> = {}
  ): void {
    const level = severity === 'critical' || severity === 'high' ? LogLevel.ERROR :
                 severity === 'medium' ? LogLevel.WARN : LogLevel.INFO;
    
    this.log(level, `Security event: ${event}`, {
      ...metadata,
      event,
      severity,
    });
  }

  /**
   * Log AI interaction
   */
  logAIInteraction(
    model: string,
    operation: string,
    tokens: number,
    duration: number,
    success: boolean = true,
    metadata: Record<string, any> = {}
  ): void {
    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    
    this.log(level, `AI ${operation} with ${model}`, {
      ...metadata,
      model,
      operation,
      tokens,
      duration,
      success,
    });
  }

  /**
   * Log performance metric
   */
  logPerformanceMetric(
    metric: string,
    value: number,
    unit: string = 'ms',
    metadata: Record<string, any> = {}
  ): void {
    this.info(`Performance metric: ${metric}`, {
      ...metadata,
      metric,
      value,
      unit,
    });
  }
}

/**
 * Create a logger instance for a component
 */
export function createLogger(component: string, config: Partial<LoggerConfig> = {}): Logger {
  return new Logger(component, config);
}

/**
 * Default logger instance
 */
export const logger = createLogger('ara-system');

/**
 * Express/API middleware for request logging
 */
export function createLoggingMiddleware(componentLogger?: Logger) {
  const requestLogger = componentLogger || createLogger('http');
  
  return async (request: Request, next: () => Promise<Response>): Promise<Response> => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    const method = request.method;
    const path = new URL(request.url).pathname;
    
    // Create request-scoped logger
    const contextLogger = requestLogger.withContext({
      requestId,
      method,
      path,
    });
    
    contextLogger.info('Request started');
    
    try {
      const response = await next();
      const duration = Date.now() - startTime;
      
      contextLogger.logRequest(method, path, response.status, duration);
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      contextLogger.error(
        'Request failed',
        error instanceof Error ? error : new Error(String(error)),
        { method, path, duration }
      );
      
      throw error;
    }
  };
}

/**
 * Uncaught exception and unhandled rejection logging
 */
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception', error, {
    fatal: true,
    source: 'process.uncaughtException',
  });
  
  // Give time for log to be written before exiting
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<any>) => {
  logger.error('Unhandled promise rejection', 
    reason instanceof Error ? reason : new Error(String(reason)), {
    fatal: false,
    source: 'process.unhandledRejection',
    promise: promise.toString(),
  });
});

// Export default logger for convenience
export default logger;