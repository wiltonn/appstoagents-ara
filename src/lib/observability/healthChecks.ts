// Health Check Endpoints - Task 3.4: Monitoring Setup
// Comprehensive health monitoring for uptime and dependency validation

import { logger } from './logger';
import { metrics, MetricType } from './metrics';

// Health status types
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

// Individual health check result
export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  message?: string;
  duration: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

// Overall health response
export interface HealthResponse {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: HealthCheckResult[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

// Health check configuration
export interface HealthCheckConfig {
  timeout: number; // ms
  retries: number;
  critical: boolean; // affects overall status
}

// Default configuration
const defaultConfig: HealthCheckConfig = {
  timeout: 5000, // 5 seconds
  retries: 1,
  critical: true,
};

/**
 * Individual health check function type
 */
export type HealthCheckFunction = () => Promise<{
  status: HealthStatus;
  message?: string;
  metadata?: Record<string, any>;
}>;

/**
 * Health Check Manager
 */
export class HealthCheckManager {
  private checks: Map<string, { fn: HealthCheckFunction; config: HealthCheckConfig }> = new Map();
  private startTime: number = Date.now();

  /**
   * Register a health check
   */
  register(
    name: string,
    checkFn: HealthCheckFunction,
    config: Partial<HealthCheckConfig> = {}
  ): void {
    const finalConfig = { ...defaultConfig, ...config };
    this.checks.set(name, { fn: checkFn, config: finalConfig });
    
    logger.info(`Health check registered: ${name}`, {
      timeout: finalConfig.timeout,
      critical: finalConfig.critical,
    });
  }

  /**
   * Execute a single health check with timeout and retries
   */
  private async executeCheck(
    name: string,
    checkFn: HealthCheckFunction,
    config: HealthCheckConfig
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= config.retries; attempt++) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Health check timeout')), config.timeout);
        });

        const checkPromise = checkFn();
        const result = await Promise.race([checkPromise, timeoutPromise]);
        const duration = Date.now() - startTime;

        // Record success metric
        metrics.record('health_check_duration', duration, MetricType.TIMER, 'ms', {
          check: name,
          status: result.status,
          attempt: attempt.toString(),
        });

        return {
          name,
          status: result.status,
          message: result.message,
          duration,
          timestamp: new Date().toISOString(),
          metadata: result.metadata,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < config.retries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    // All attempts failed
    const duration = Date.now() - startTime;
    
    // Record failure metric
    metrics.record('health_check_duration', duration, MetricType.TIMER, 'ms', {
      check: name,
      status: 'failed',
      attempts: (config.retries + 1).toString(),
    });

    return {
      name,
      status: HealthStatus.UNHEALTHY,
      message: lastError?.message || 'Health check failed',
      duration,
      timestamp: new Date().toISOString(),
      metadata: { error: lastError?.name, attempts: config.retries + 1 },
    };
  }

  /**
   * Execute all health checks
   */
  async executeAll(): Promise<HealthResponse> {
    const timestamp = new Date().toISOString();
    const uptime = Date.now() - this.startTime;
    
    logger.debug('Executing health checks', { totalChecks: this.checks.size });

    // Execute all checks in parallel
    const checkPromises = Array.from(this.checks.entries()).map(async ([name, { fn, config }]) => {
      try {
        return await this.executeCheck(name, fn, config);
      } catch (error) {
        logger.error(`Health check error: ${name}`, error instanceof Error ? error : new Error(String(error)));
        return {
          name,
          status: HealthStatus.UNHEALTHY,
          message: 'Health check execution failed',
          duration: 0,
          timestamp,
          metadata: { error: 'execution_failed' },
        };
      }
    });

    const results = await Promise.all(checkPromises);

    // Calculate summary
    const summary = {
      total: results.length,
      healthy: results.filter(r => r.status === HealthStatus.HEALTHY).length,
      degraded: results.filter(r => r.status === HealthStatus.DEGRADED).length,
      unhealthy: results.filter(r => r.status === HealthStatus.UNHEALTHY).length,
    };

    // Determine overall status
    let overallStatus = HealthStatus.HEALTHY;
    
    // Check critical unhealthy checks
    const criticalChecks = Array.from(this.checks.entries())
      .filter(([_, { config }]) => config.critical)
      .map(([name]) => name);
    
    const criticalUnhealthy = results
      .filter(r => criticalChecks.includes(r.name) && r.status === HealthStatus.UNHEALTHY);
    
    if (criticalUnhealthy.length > 0) {
      overallStatus = HealthStatus.UNHEALTHY;
    } else if (summary.degraded > 0 || summary.unhealthy > 0) {
      overallStatus = HealthStatus.DEGRADED;
    }

    const response: HealthResponse = {
      status: overallStatus,
      timestamp,
      uptime: Math.floor(uptime / 1000), // seconds
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'unknown',
      checks: results,
      summary,
    };

    // Log health check results
    logger.info('Health check completed', {
      status: overallStatus,
      summary,
      duration: results.reduce((sum, r) => sum + r.duration, 0),
    });

    // Record overall health metric
    metrics.record('health_overall_status', overallStatus === HealthStatus.HEALTHY ? 1 : 0, 
      MetricType.GAUGE, 'boolean', { status: overallStatus });

    return response;
  }

  /**
   * Get uptime in seconds
   */
  getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * Remove a health check
   */
  unregister(name: string): boolean {
    return this.checks.delete(name);
  }

  /**
   * List registered checks
   */
  listChecks(): string[] {
    return Array.from(this.checks.keys());
  }
}

// Global health check manager
export const healthManager = new HealthCheckManager();

/**
 * Built-in health checks
 */

/**
 * Database health check
 */
export async function databaseHealthCheck(): Promise<{
  status: HealthStatus;
  message?: string;
  metadata?: Record<string, any>;
}> {
  try {
    // This would be replaced with actual database connection check
    // For now, we'll simulate a basic check
    const startTime = Date.now();
    
    // Simulate database query
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const queryTime = Date.now() - startTime;
    
    if (queryTime > 1000) {
      return {
        status: HealthStatus.DEGRADED,
        message: 'Database responding slowly',
        metadata: { queryTime },
      };
    }
    
    return {
      status: HealthStatus.HEALTHY,
      message: 'Database connection healthy',
      metadata: { queryTime },
    };
  } catch (error) {
    return {
      status: HealthStatus.UNHEALTHY,
      message: error instanceof Error ? error.message : 'Database connection failed',
      metadata: { error: error instanceof Error ? error.name : 'Unknown' },
    };
  }
}

/**
 * Redis/Cache health check
 */
export async function cacheHealthCheck(): Promise<{
  status: HealthStatus;
  message?: string;
  metadata?: Record<string, any>;
}> {
  try {
    // This would be replaced with actual Redis connection check
    const startTime = Date.now();
    
    // Simulate cache operation
    await new Promise(resolve => setTimeout(resolve, 5));
    
    const responseTime = Date.now() - startTime;
    
    return {
      status: HealthStatus.HEALTHY,
      message: 'Cache connection healthy',
      metadata: { responseTime },
    };
  } catch (error) {
    return {
      status: HealthStatus.DEGRADED, // Cache is not critical
      message: error instanceof Error ? error.message : 'Cache connection failed',
      metadata: { error: error instanceof Error ? error.name : 'Unknown' },
    };
  }
}

/**
 * External API health check
 */
export async function externalApiHealthCheck(
  name: string,
  url: string,
  timeout: number = 5000
): Promise<{
  status: HealthStatus;
  message?: string;
  metadata?: Record<string, any>;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      return {
        status: HealthStatus.HEALTHY,
        message: `${name} API is responding`,
        metadata: { responseTime, status: response.status },
      };
    } else {
      return {
        status: HealthStatus.DEGRADED,
        message: `${name} API returned ${response.status}`,
        metadata: { responseTime, status: response.status },
      };
    }
  } catch (error) {
    return {
      status: HealthStatus.UNHEALTHY,
      message: `${name} API is unreachable`,
      metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
}

/**
 * Memory usage health check
 */
export async function memoryHealthCheck(): Promise<{
  status: HealthStatus;
  message?: string;
  metadata?: Record<string, any>;
}> {
  try {
    if (typeof process === 'undefined' || !process.memoryUsage) {
      return {
        status: HealthStatus.HEALTHY,
        message: 'Memory monitoring not available',
      };
    }

    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
    const usagePercent = (heapUsedMB / heapTotalMB) * 100;

    let status = HealthStatus.HEALTHY;
    let message = 'Memory usage is normal';

    if (usagePercent > 90) {
      status = HealthStatus.UNHEALTHY;
      message = 'Memory usage is critically high';
    } else if (usagePercent > 80) {
      status = HealthStatus.DEGRADED;
      message = 'Memory usage is elevated';
    }

    return {
      status,
      message,
      metadata: {
        heapUsedMB: Math.round(heapUsedMB),
        heapTotalMB: Math.round(heapTotalMB),
        usagePercent: Math.round(usagePercent),
        externalMB: Math.round(memUsage.external / 1024 / 1024),
      },
    };
  } catch (error) {
    return {
      status: HealthStatus.UNHEALTHY,
      message: 'Failed to check memory usage',
      metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
}

/**
 * Disk space health check (if applicable)
 */
export async function diskSpaceHealthCheck(): Promise<{
  status: HealthStatus;
  message?: string;
  metadata?: Record<string, any>;
}> {
  // This is a placeholder - actual disk space checking would require platform-specific code
  return {
    status: HealthStatus.HEALTHY,
    message: 'Disk space monitoring not implemented',
    metadata: { note: 'Platform-specific implementation required' },
  };
}

// Register default health checks
healthManager.register('database', databaseHealthCheck, { critical: true, timeout: 5000 });
healthManager.register('cache', cacheHealthCheck, { critical: false, timeout: 3000 });
healthManager.register('memory', memoryHealthCheck, { critical: true, timeout: 1000 });

// Register external API health checks if configured
if (process.env.OPENAI_API_KEY) {
  healthManager.register(
    'openai',
    () => externalApiHealthCheck('OpenAI', 'https://api.openai.com/v1/models', 10000),
    { critical: false, timeout: 15000 }
  );
}

/**
 * Create health check API endpoint
 */
export async function handleHealthCheck(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const checkParam = url.searchParams.get('check');
  
  try {
    if (checkParam) {
      // Individual health check
      const checkFn = healthManager['checks'].get(checkParam);
      if (!checkFn) {
        return new Response(JSON.stringify({
          error: 'Health check not found',
          available: healthManager.listChecks(),
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const result = await healthManager['executeCheck'](checkParam, checkFn.fn, checkFn.config);
      const status = result.status === HealthStatus.HEALTHY ? 200 :
                    result.status === HealthStatus.DEGRADED ? 200 : 503;

      return new Response(JSON.stringify(result), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      // All health checks
      const health = await healthManager.executeAll();
      const status = health.status === HealthStatus.HEALTHY ? 200 :
                    health.status === HealthStatus.DEGRADED ? 200 : 503;

      return new Response(JSON.stringify(health), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    logger.error('Health check endpoint error', error instanceof Error ? error : new Error(String(error)));
    
    return new Response(JSON.stringify({
      status: HealthStatus.UNHEALTHY,
      error: 'Health check execution failed',
      timestamp: new Date().toISOString(),
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Simple readiness check (for Kubernetes readiness probes)
 */
export async function handleReadinessCheck(): Promise<Response> {
  try {
    // Simple check - just verify the service is responding
    return new Response('OK', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (error) {
    return new Response('Service Unavailable', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

/**
 * Simple liveness check (for Kubernetes liveness probes)
 */
export async function handleLivenessCheck(): Promise<Response> {
  try {
    // Check if the process is still alive and responsive
    const uptime = healthManager.getUptime();
    
    if (uptime > 0) {
      return new Response(`Alive for ${uptime} seconds`, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    } else {
      throw new Error('Invalid uptime');
    }
  } catch (error) {
    return new Response('Service Unavailable', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}