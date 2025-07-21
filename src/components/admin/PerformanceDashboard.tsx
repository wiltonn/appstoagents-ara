// Performance Monitoring Dashboard - Task 3.1: Performance Optimization
// Real-time performance metrics and monitoring visualization

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

interface PerformanceMetrics {
  timestamp: string;
  requestTime: number;
  cache: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    connected: boolean;
    latency?: number;
    metrics: {
      hits: number;
      misses: number;
      sets: number;
      deletes: number;
      errors: number;
      hitRatio: number;
    };
  };
  database: {
    status: 'healthy' | 'unhealthy';
    queryTime: number;
    queryStats: {
      totalQueries: number;
      averageDuration: number;
      cachedQueries: number;
      cacheHitRate: number;
      slowQueries: number;
    };
  };
  api: {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    slowRequestRate: number;
  };
  system: {
    nodeVersion: string;
    uptime: number;
    memory: {
      used: number;
      total: number;
      external: number;
    };
  };
}

export function PerformanceDashboard() {
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch performance metrics
  const { data: metrics, isLoading, error, refetch } = useQuery<PerformanceMetrics>({
    queryKey: ['admin', 'performance'],
    queryFn: async () => {
      const response = await fetch('/api/admin/performance');
      if (!response.ok) {
        throw new Error('Failed to fetch performance metrics');
      }
      return response.json();
    },
    refetchInterval: autoRefresh ? 30000 : false, // Refresh every 30 seconds
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="loading loading-spinner loading-lg"></div>
        <span className="ml-4">Loading performance metrics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span>Failed to load performance metrics: {error.message}</span>
        <button className="btn btn-sm" onClick={() => refetch()}>
          Retry
        </button>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="alert alert-warning">
        <span>No performance data available</span>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-success';
      case 'degraded': return 'text-warning';
      case 'unhealthy': return 'text-error';
      default: return 'text-base-content';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy': return 'badge-success';
      case 'degraded': return 'badge-warning';
      case 'unhealthy': return 'badge-error';
      default: return 'badge-neutral';
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Performance Dashboard</h1>
          <p className="text-base-content/70">
            Last updated: {new Date(metrics.timestamp).toLocaleTimeString()}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="form-control">
            <label className="label cursor-pointer">
              <span className="label-text mr-2">Auto-refresh</span>
              <input 
                type="checkbox" 
                className="toggle toggle-primary" 
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
            </label>
          </div>
          
          <button 
            className="btn btn-primary btn-sm"
            onClick={() => refetch()}
          >
            Refresh Now
          </button>
        </div>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="stat bg-base-200 rounded-lg">
          <div className="stat-title">System Status</div>
          <div className="stat-value text-success">Healthy</div>
          <div className="stat-desc">
            Uptime: {formatUptime(metrics.system.uptime)}
          </div>
        </div>
        
        <div className="stat bg-base-200 rounded-lg">
          <div className="stat-title">Memory Usage</div>
          <div className="stat-value text-sm">
            {metrics.system.memory.used}MB
          </div>
          <div className="stat-desc">
            of {metrics.system.memory.total}MB total
          </div>
        </div>
        
        <div className="stat bg-base-200 rounded-lg">
          <div className="stat-title">API Response</div>
          <div className="stat-value text-sm">
            {metrics.api.averageResponseTime}ms
          </div>
          <div className="stat-desc">
            Error rate: {metrics.api.errorRate}%
          </div>
        </div>
        
        <div className="stat bg-base-200 rounded-lg">
          <div className="stat-title">Request Time</div>
          <div className="stat-value text-sm">
            {metrics.requestTime}ms
          </div>
          <div className="stat-desc">
            This dashboard load
          </div>
        </div>
      </div>

      {/* Service Status Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cache Status */}
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <h2 className="card-title">Redis Cache</h2>
              <div className={`badge ${getStatusBadge(metrics.cache.status)}`}>
                {metrics.cache.status}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="stat">
                <div className="stat-title text-xs">Hit Ratio</div>
                <div className="stat-value text-lg">
                  {Math.round(metrics.cache.metrics.hitRatio * 100)}%
                </div>
              </div>
              
              <div className="stat">
                <div className="stat-title text-xs">Latency</div>
                <div className="stat-value text-lg">
                  {metrics.cache.latency || 0}ms
                </div>
              </div>
              
              <div className="stat">
                <div className="stat-title text-xs">Cache Hits</div>
                <div className="stat-value text-lg">
                  {metrics.cache.metrics.hits}
                </div>
              </div>
              
              <div className="stat">
                <div className="stat-title text-xs">Cache Misses</div>
                <div className="stat-value text-lg">
                  {metrics.cache.metrics.misses}
                </div>
              </div>
            </div>
            
            {metrics.cache.status !== 'healthy' && (
              <div className="alert alert-warning mt-4">
                <span>Cache performance is degraded</span>
              </div>
            )}
          </div>
        </div>

        {/* Database Status */}
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <h2 className="card-title">Database</h2>
              <div className={`badge ${getStatusBadge(metrics.database.status)}`}>
                {metrics.database.status}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="stat">
                <div className="stat-title text-xs">Query Time</div>
                <div className="stat-value text-lg">
                  {metrics.database.queryTime}ms
                </div>
              </div>
              
              <div className="stat">
                <div className="stat-title text-xs">Avg Duration</div>
                <div className="stat-value text-lg">
                  {metrics.database.queryStats.averageDuration}ms
                </div>
              </div>
              
              <div className="stat">
                <div className="stat-title text-xs">Total Queries</div>
                <div className="stat-value text-lg">
                  {metrics.database.queryStats.totalQueries}
                </div>
              </div>
              
              <div className="stat">
                <div className="stat-title text-xs">Slow Queries</div>
                <div className="stat-value text-lg">
                  {metrics.database.queryStats.slowQueries}
                </div>
              </div>
            </div>
            
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-2">
                <span>Cache Hit Rate</span>
                <span>{metrics.database.queryStats.cacheHitRate}%</span>
              </div>
              <progress 
                className="progress progress-primary w-full" 
                value={metrics.database.queryStats.cacheHitRate} 
                max="100"
              ></progress>
            </div>
          </div>
        </div>
      </div>

      {/* API Performance */}
      <div className="card bg-base-200 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">API Performance</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <div className="stat">
              <div className="stat-title">Total Requests</div>
              <div className="stat-value text-lg">
                {metrics.api.totalRequests.toLocaleString()}
              </div>
            </div>
            
            <div className="stat">
              <div className="stat-title">Avg Response Time</div>
              <div className="stat-value text-lg">
                {metrics.api.averageResponseTime}ms
              </div>
              <div className="stat-desc">
                Target: &lt;200ms
              </div>
            </div>
            
            <div className="stat">
              <div className="stat-title">Error Rate</div>
              <div className="stat-value text-lg">
                {metrics.api.errorRate}%
              </div>
              <div className="stat-desc">
                Target: &lt;1%
              </div>
            </div>
            
            <div className="stat">
              <div className="stat-title">Slow Requests</div>
              <div className="stat-value text-lg">
                {metrics.api.slowRequestRate}%
              </div>
              <div className="stat-desc">
                &gt;1s response time
              </div>
            </div>
          </div>

          {/* Performance Indicators */}
          <div className="mt-6 space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Response Time Performance</span>
                <span className={metrics.api.averageResponseTime <= 200 ? 'text-success' : 'text-warning'}>
                  {metrics.api.averageResponseTime <= 200 ? 'Good' : 'Needs Improvement'}
                </span>
              </div>
              <progress 
                className={`progress w-full ${metrics.api.averageResponseTime <= 200 ? 'progress-success' : 'progress-warning'}`}
                value={Math.min(metrics.api.averageResponseTime, 500)} 
                max="500"
              ></progress>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Error Rate</span>
                <span className={metrics.api.errorRate <= 1 ? 'text-success' : 'text-error'}>
                  {metrics.api.errorRate <= 1 ? 'Good' : 'High'}
                </span>
              </div>
              <progress 
                className={`progress w-full ${metrics.api.errorRate <= 1 ? 'progress-success' : 'progress-error'}`}
                value={metrics.api.errorRate} 
                max="10"
              ></progress>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Alerts */}
      <div className="space-y-2">
        {metrics.api.averageResponseTime > 200 && (
          <div className="alert alert-warning">
            <span>⚠️ API response time is above target (200ms)</span>
          </div>
        )}
        
        {metrics.api.errorRate > 1 && (
          <div className="alert alert-error">
            <span>🚨 API error rate is above acceptable threshold (1%)</span>
          </div>
        )}
        
        {metrics.cache.metrics.hitRatio < 0.8 && (
          <div className="alert alert-warning">
            <span>⚠️ Cache hit ratio is below target (80%)</span>
          </div>
        )}
        
        {metrics.database.queryStats.slowQueries > 5 && (
          <div className="alert alert-warning">
            <span>⚠️ High number of slow database queries detected</span>
          </div>
        )}
      </div>
    </div>
  );
}