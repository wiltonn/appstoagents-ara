// Performance Monitoring and Metrics - Task 3.4: Monitoring Setup
// Comprehensive metrics collection and performance monitoring

import { logger } from './logger';
import { addSpanAttributes, addSpanEvent } from './telemetry';

// Metric types
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  TIMER = 'timer',
}

// Metric data structure
export interface Metric {
  name: string;
  type: MetricType;
  value: number;
  unit: string;
  timestamp: number;
  tags: Record<string, string>;
  description?: string;
}

// Performance thresholds
export interface PerformanceThresholds {
  apiResponseTime: number; // ms
  databaseQueryTime: number; // ms
  cacheHitRatio: number; // percentage
  errorRate: number; // percentage
  memoryUsage: number; // MB
  cpuUsage: number; // percentage
}

// Default thresholds
const defaultThresholds: PerformanceThresholds = {
  apiResponseTime: 500, // 500ms
  databaseQueryTime: 100, // 100ms
  cacheHitRatio: 80, // 80%
  errorRate: 1, // 1%
  memoryUsage: 500, // 500MB
  cpuUsage: 80, // 80%
};

// Metric aggregation window
interface MetricWindow {
  values: number[];
  timestamps: number[];
  startTime: number;
  windowSize: number; // minutes
}

/**
 * Metrics Collector for performance monitoring and alerting
 */
export class MetricsCollector {
  private metrics: Map<string, Metric[]> = new Map();
  private windows: Map<string, MetricWindow> = new Map();
  private thresholds: PerformanceThresholds;
  private alertCooldowns: Map<string, number> = new Map();

  constructor(thresholds: Partial<PerformanceThresholds> = {}) {
    this.thresholds = { ...defaultThresholds, ...thresholds };
  }

  /**
   * Record a metric value
   */
  record(
    name: string,
    value: number,
    type: MetricType = MetricType.GAUGE,
    unit: string = '',
    tags: Record<string, string> = {},
    description?: string
  ): void {
    const metric: Metric = {
      name,
      type,
      value,
      unit,
      timestamp: Date.now(),
      tags,
      description,
    };

    // Store metric
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(metric);

    // Update aggregation window
    this.updateWindow(name, value);

    // Log metric
    logger.debug(`Metric recorded: ${name}`, {
      value,
      type,
      unit,
      tags,
    });

    // Add to tracing
    addSpanEvent('metric.recorded', {
      'metric.name': name,
      'metric.value': value,
      'metric.type': type,
      'metric.unit': unit,
    });

    // Check thresholds
    this.checkThresholds(name, value, tags);
  }

  /**
   * Update aggregation window for metric
   */
  private updateWindow(name: string, value: number, windowSizeMinutes: number = 5): void {
    const now = Date.now();
    const windowSizeMs = windowSizeMinutes * 60 * 1000;

    if (!this.windows.has(name)) {
      this.windows.set(name, {
        values: [],
        timestamps: [],
        startTime: now,
        windowSize: windowSizeMinutes,
      });
    }

    const window = this.windows.get(name)!;
    window.values.push(value);
    window.timestamps.push(now);

    // Remove old values outside the window
    const cutoff = now - windowSizeMs;
    while (window.timestamps.length > 0 && window.timestamps[0] < cutoff) {
      window.values.shift();
      window.timestamps.shift();
    }
  }

  /**
   * Check performance thresholds and alert if exceeded
   */
  private checkThresholds(name: string, value: number, tags: Record<string, string>): void {
    let threshold: number | undefined;
    let severity: 'warning' | 'critical' = 'warning';

    // Map metric names to thresholds
    if (name.includes('response_time') || name.includes('api_duration')) {
      threshold = this.thresholds.apiResponseTime;
      severity = value > threshold * 2 ? 'critical' : 'warning';
    } else if (name.includes('db_query') || name.includes('database_duration')) {
      threshold = this.thresholds.databaseQueryTime;
      severity = value > threshold * 3 ? 'critical' : 'warning';
    } else if (name.includes('cache_hit_ratio')) {
      threshold = this.thresholds.cacheHitRatio;
      severity = value < threshold * 0.5 ? 'critical' : 'warning';
      if (value >= threshold) return; // Hit ratio is good
    } else if (name.includes('error_rate')) {
      threshold = this.thresholds.errorRate;
      severity = value > threshold * 5 ? 'critical' : 'warning';
    } else if (name.includes('memory_usage')) {
      threshold = this.thresholds.memoryUsage;
      severity = value > threshold * 1.5 ? 'critical' : 'warning';
    } else if (name.includes('cpu_usage')) {
      threshold = this.thresholds.cpuUsage;
      severity = value > threshold * 1.2 ? 'critical' : 'warning';
    }

    if (threshold === undefined) return;

    // Check if threshold is exceeded
    const isExceeded = name.includes('cache_hit_ratio') ? 
      value < threshold : value > threshold;

    if (isExceeded) {
      const alertKey = `${name}_${severity}`;
      const now = Date.now();
      const lastAlert = this.alertCooldowns.get(alertKey);
      const cooldownMs = 5 * 60 * 1000; // 5 minutes

      if (!lastAlert || (now - lastAlert) > cooldownMs) {
        this.alertCooldowns.set(alertKey, now);
        
        logger.warn(`Performance threshold exceeded: ${name}`, {
          metric: name,
          value,
          threshold,
          severity,
          tags,
        });

        addSpanEvent('threshold.exceeded', {
          'metric.name': name,
          'metric.value': value,
          'metric.threshold': threshold,
          'alert.severity': severity,
        });
      }
    }
  }

  /**
   * Get aggregated metrics for a time window
   */
  getAggregatedMetrics(
    name: string,
    windowMinutes: number = 5
  ): {
    count: number;
    avg: number;
    min: number;
    max: number;
    sum: number;
    p95: number;
    p99: number;
  } | null {
    const window = this.windows.get(name);
    if (!window || window.values.length === 0) {
      return null;
    }

    const values = [...window.values].sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((acc, val) => acc + val, 0);
    const avg = sum / count;
    const min = values[0];
    const max = values[values.length - 1];
    const p95Index = Math.floor(count * 0.95);
    const p99Index = Math.floor(count * 0.99);
    const p95 = values[Math.min(p95Index, count - 1)];
    const p99 = values[Math.min(p99Index, count - 1)];

    return { count, avg, min, max, sum, p95, p99 };
  }

  /**
   * Get current metric values
   */
  getCurrentMetrics(): Record<string, Metric[]> {
    const result: Record<string, Metric[]> = {};
    for (const [name, metrics] of this.metrics.entries()) {
      result[name] = metrics.slice(-10); // Last 10 values
    }
    return result;
  }

  /**
   * Clear old metrics
   */
  cleanup(olderThanMinutes: number = 60): void {
    const cutoff = Date.now() - (olderThanMinutes * 60 * 1000);

    for (const [name, metrics] of this.metrics.entries()) {
      const filtered = metrics.filter(m => m.timestamp > cutoff);
      if (filtered.length === 0) {
        this.metrics.delete(name);
      } else {
        this.metrics.set(name, filtered);
      }
    }

    // Clean up alert cooldowns
    for (const [key, timestamp] of this.alertCooldowns.entries()) {
      if (timestamp < cutoff) {
        this.alertCooldowns.delete(key);
      }
    }
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusMetrics(): string {
    const lines: string[] = [];

    for (const [name, metrics] of this.metrics.entries()) {
      if (metrics.length === 0) continue;

      const latest = metrics[metrics.length - 1];
      const sanitizedName = name.replace(/[^a-zA-Z0-9_]/g, '_');
      
      // Add description if available
      if (latest.description) {
        lines.push(`# HELP ${sanitizedName} ${latest.description}`);
      }
      
      // Add type
      lines.push(`# TYPE ${sanitizedName} ${latest.type}`);
      
      // Add metric value with tags
      const tags = Object.entries(latest.tags)
        .map(([key, value]) => `${key}="${value}"`)
        .join(',');
      
      const tagString = tags ? `{${tags}}` : '';
      lines.push(`${sanitizedName}${tagString} ${latest.value} ${latest.timestamp}`);
    }

    return lines.join('\n');
  }
}

// Global metrics collector
export const metrics = new MetricsCollector();

/**
 * Timer utility for measuring execution time
 */
export class Timer {
  private startTime: number;
  private name: string;
  private tags: Record<string, string>;

  constructor(name: string, tags: Record<string, string> = {}) {
    this.name = name;
    this.tags = tags;
    this.startTime = Date.now();
  }

  /**
   * Stop timer and record metric
   */
  stop(): number {
    const duration = Date.now() - this.startTime;
    metrics.record(this.name, duration, MetricType.TIMER, 'ms', this.tags);
    return duration;
  }
}

/**
 * Create a timer for measuring execution time
 */
export function createTimer(name: string, tags: Record<string, string> = {}): Timer {
  return new Timer(name, tags);
}

/**
 * Measure function execution time
 */
export async function measureTime<T>(
  name: string,
  fn: () => Promise<T>,
  tags: Record<string, string> = {}
): Promise<{ result: T; duration: number }> {
  const timer = createTimer(name, tags);
  try {
    const result = await fn();
    const duration = timer.stop();
    return { result, duration };
  } catch (error) {
    timer.stop();
    throw error;
  }
}

/**
 * System metrics collection
 */
export function collectSystemMetrics(): void {
  // Memory usage
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const memUsage = process.memoryUsage();
    metrics.record('system_memory_used', memUsage.heapUsed / 1024 / 1024, MetricType.GAUGE, 'MB');
    metrics.record('system_memory_total', memUsage.heapTotal / 1024 / 1024, MetricType.GAUGE, 'MB');
    metrics.record('system_memory_external', memUsage.external / 1024 / 1024, MetricType.GAUGE, 'MB');
  }

  // Process uptime
  if (typeof process !== 'undefined' && process.uptime) {
    metrics.record('system_uptime', process.uptime(), MetricType.GAUGE, 'seconds');
  }
}

/**
 * Database metrics helpers
 */
export const dbMetrics = {
  recordQuery: (operation: string, table: string, duration: number, success: boolean = true) => {
    metrics.record('db_query_duration', duration, MetricType.TIMER, 'ms', {
      operation,
      table,
      success: success.toString(),
    });
  },

  recordConnection: (pool: string, active: number, idle: number) => {
    metrics.record('db_connections_active', active, MetricType.GAUGE, 'count', { pool });
    metrics.record('db_connections_idle', idle, MetricType.GAUGE, 'count', { pool });
  },

  recordError: (operation: string, table: string, errorType: string) => {
    metrics.record('db_errors', 1, MetricType.COUNTER, 'count', {
      operation,
      table,
      error_type: errorType,
    });
  },
};

/**
 * HTTP metrics helpers
 */
export const httpMetrics = {
  recordRequest: (method: string, path: string, status: number, duration: number) => {
    metrics.record('http_request_duration', duration, MetricType.TIMER, 'ms', {
      method,
      path,
      status: status.toString(),
    });
    
    metrics.record('http_requests_total', 1, MetricType.COUNTER, 'count', {
      method,
      path,
      status: status.toString(),
    });
  },

  recordError: (method: string, path: string, errorType: string) => {
    metrics.record('http_errors', 1, MetricType.COUNTER, 'count', {
      method,
      path,
      error_type: errorType,
    });
  },
};

/**
 * Cache metrics helpers
 */
export const cacheMetrics = {
  recordHit: (cacheType: string, key: string) => {
    metrics.record('cache_hits', 1, MetricType.COUNTER, 'count', {
      cache_type: cacheType,
      operation: 'hit',
    });
  },

  recordMiss: (cacheType: string, key: string) => {
    metrics.record('cache_misses', 1, MetricType.COUNTER, 'count', {
      cache_type: cacheType,
      operation: 'miss',
    });
  },

  recordSet: (cacheType: string, key: string, duration: number) => {
    metrics.record('cache_set_duration', duration, MetricType.TIMER, 'ms', {
      cache_type: cacheType,
    });
  },

  recordHitRatio: (cacheType: string, ratio: number) => {
    metrics.record('cache_hit_ratio', ratio, MetricType.GAUGE, 'percentage', {
      cache_type: cacheType,
    });
  },
};

/**
 * Business metrics helpers
 */
export const businessMetrics = {
  recordWizardCompletion: (userId: string | null, steps: number, duration: number) => {
    metrics.record('wizard_completions', 1, MetricType.COUNTER, 'count', {
      user_type: userId ? 'authenticated' : 'guest',
    });
    
    metrics.record('wizard_completion_time', duration, MetricType.TIMER, 'ms', {
      user_type: userId ? 'authenticated' : 'guest',
    });
    
    metrics.record('wizard_steps_completed', steps, MetricType.GAUGE, 'count', {
      user_type: userId ? 'authenticated' : 'guest',
    });
  },

  recordChatInteraction: (userId: string | null, tokens: number, duration: number) => {
    metrics.record('chat_interactions', 1, MetricType.COUNTER, 'count', {
      user_type: userId ? 'authenticated' : 'guest',
    });
    
    metrics.record('chat_response_time', duration, MetricType.TIMER, 'ms', {
      user_type: userId ? 'authenticated' : 'guest',
    });
    
    metrics.record('chat_tokens_used', tokens, MetricType.GAUGE, 'count', {
      user_type: userId ? 'authenticated' : 'guest',
    });
  },

  recordReportGeneration: (format: string, duration: number, success: boolean) => {
    metrics.record('reports_generated', 1, MetricType.COUNTER, 'count', {
      format,
      success: success.toString(),
    });
    
    metrics.record('report_generation_time', duration, MetricType.TIMER, 'ms', {
      format,
      success: success.toString(),
    });
  },
};

// Collect system metrics every minute
if (typeof setInterval !== 'undefined') {
  setInterval(collectSystemMetrics, 60 * 1000);
  
  // Cleanup old metrics every hour
  setInterval(() => {
    metrics.cleanup();
  }, 60 * 60 * 1000);
}

// Initial system metrics collection
collectSystemMetrics();