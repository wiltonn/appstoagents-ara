// Performance Monitoring API - Task 3.1: Performance Optimization
// Provides real-time performance metrics and monitoring data

import type { APIRoute } from 'astro';
import { cache } from '../../../lib/cache';
import { dbOptimized } from '../../../lib/dbOptimized';

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const metric = url.searchParams.get('metric') || 'all';
    const period = url.searchParams.get('period') || 'hour';

    const startTime = Date.now();

    // Collect performance data
    const performanceData: any = {
      timestamp: new Date().toISOString(),
      requestTime: 0, // Will be calculated at the end
    };

    if (metric === 'all' || metric === 'cache') {
      // Cache metrics
      const cacheHealth = await cache.healthCheck();
      performanceData.cache = {
        ...cacheHealth,
        hitRatio: Math.round(cacheHealth.metrics.hitRatio * 100),
      };
    }

    if (metric === 'all' || metric === 'database') {
      // Database metrics
      const dbHealth = await dbOptimized.getDatabaseHealth();
      const queryStats = dbOptimized.getQueryStats();
      
      performanceData.database = {
        status: dbHealth.status,
        queryTime: dbHealth.queryTime,
        queryStats,
        recentQueries: dbHealth.recentQueries?.slice(-10), // Last 10 queries
      };
    }

    if (metric === 'all' || metric === 'api') {
      // API performance metrics
      performanceData.api = await getAPIMetrics();
    }

    if (metric === 'all' || metric === 'system') {
      // System metrics
      performanceData.system = {
        nodeVersion: process.version,
        uptime: Math.round(process.uptime()),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024),
        },
        cpu: process.cpuUsage(),
      };
    }

    // Calculate request time
    performanceData.requestTime = Date.now() - startTime;

    return new Response(JSON.stringify(performanceData), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      }
    });

  } catch (error) {
    console.error('Error getting performance metrics:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get performance metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Store API metrics in memory (in production, use Redis or database)
const apiMetrics = {
  requests: 0,
  totalTime: 0,
  errors: 0,
  slowRequests: 0,
  endpoints: new Map<string, {
    count: number;
    totalTime: number;
    errors: number;
    averageTime: number;
  }>(),
};

async function getAPIMetrics() {
  const avgResponseTime = apiMetrics.requests > 0 
    ? Math.round(apiMetrics.totalTime / apiMetrics.requests) 
    : 0;

  const errorRate = apiMetrics.requests > 0 
    ? Math.round((apiMetrics.errors / apiMetrics.requests) * 100) 
    : 0;

  const slowRequestRate = apiMetrics.requests > 0 
    ? Math.round((apiMetrics.slowRequests / apiMetrics.requests) * 100) 
    : 0;

  return {
    totalRequests: apiMetrics.requests,
    averageResponseTime: avgResponseTime,
    errorRate,
    slowRequestRate,
    endpoints: Array.from(apiMetrics.endpoints.entries()).map(([endpoint, stats]) => ({
      endpoint,
      ...stats,
    })).slice(0, 10), // Top 10 endpoints
  };
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Record API performance metrics
    const body = await request.json();
    const { endpoint, duration, status, error } = body;

    if (!endpoint || typeof duration !== 'number') {
      return new Response(JSON.stringify({ 
        error: 'Invalid metrics data' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update global metrics
    apiMetrics.requests++;
    apiMetrics.totalTime += duration;
    
    if (error || (status && status >= 400)) {
      apiMetrics.errors++;
    }
    
    if (duration > 1000) {
      apiMetrics.slowRequests++;
    }

    // Update endpoint-specific metrics
    const endpointStats = apiMetrics.endpoints.get(endpoint) || {
      count: 0,
      totalTime: 0,
      errors: 0,
      averageTime: 0,
    };

    endpointStats.count++;
    endpointStats.totalTime += duration;
    endpointStats.averageTime = Math.round(endpointStats.totalTime / endpointStats.count);
    
    if (error || (status && status >= 400)) {
      endpointStats.errors++;
    }

    apiMetrics.endpoints.set(endpoint, endpointStats);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Metrics recorded'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error recording performance metrics:', error);
    return new Response(JSON.stringify({
      error: 'Failed to record metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Reset metrics endpoint
export const DELETE: APIRoute = async ({ request }) => {
  try {
    // Basic authentication check
    const authHeader = request.headers.get('authorization');
    const adminKey = process.env.ADMIN_API_KEY;
    
    if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
      return new Response(JSON.stringify({ 
        error: 'Unauthorized' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Reset all metrics
    apiMetrics.requests = 0;
    apiMetrics.totalTime = 0;
    apiMetrics.errors = 0;
    apiMetrics.slowRequests = 0;
    apiMetrics.endpoints.clear();

    // Reset cache metrics
    cache.resetMetrics();

    return new Response(JSON.stringify({ 
      success: true,
      message: 'All metrics reset'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error resetting metrics:', error);
    return new Response(JSON.stringify({
      error: 'Failed to reset metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};