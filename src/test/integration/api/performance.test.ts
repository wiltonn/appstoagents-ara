// Performance API Integration Tests - Task 3.3: Testing Suite
// Integration tests for performance monitoring endpoints

import { describe, test, expect, beforeEach, vi } from 'vitest';

// Mock cache service
const mockCache = {
  getMetrics: vi.fn(),
  isHealthy: vi.fn(),
  getStats: vi.fn(),
};

vi.mock('@/lib/cache', () => ({
  cache: mockCache,
}));

// Mock database optimizer
const mockDbOptimized = {
  getMetrics: vi.fn(),
  healthCheck: vi.fn(),
};

vi.mock('@/lib/dbOptimized', () => ({
  dbOptimized: mockDbOptimized,
}));

// Test helper to create mock request
function createMockRequest(options: {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  url?: string;
} = {}) {
  const {
    method = 'GET',
    headers = {},
    body,
    url = 'http://localhost:3000/api/admin/performance'
  } = options;

  return {
    method,
    url,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] || null,
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as any;
}

// Import the API handler
const { GET, POST, DELETE } = await import('@/pages/api/admin/performance');

describe('Performance API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_API_KEY = 'test-admin-key';
  });

  describe('GET /api/admin/performance', () => {
    test('returns performance metrics with valid admin key', async () => {
      const mockCacheMetrics = {
        hits: 850,
        misses: 150,
        hitRatio: 0.85,
        sets: 200,
        deletes: 50,
        errors: 2,
      };

      const mockDbMetrics = {
        totalQueries: 1000,
        averageDuration: 45,
        cachedQueries: 600,
        cacheHitRate: 60,
        slowQueries: 15,
      };

      mockCache.getMetrics.mockReturnValue(mockCacheMetrics);
      mockCache.isHealthy.mockResolvedValue(true);
      mockDbOptimized.getMetrics.mockReturnValue(mockDbMetrics);
      mockDbOptimized.healthCheck.mockResolvedValue({ 
        status: 'healthy', 
        queryTime: 25,
        connectionCount: 5,
      });

      const request = createMockRequest({
        headers: { 'authorization': 'Bearer test-admin-key' },
      });

      const response = await GET({ request } as any);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toMatchObject({
        timestamp: expect.any(String),
        requestTime: expect.any(Number),
        cache: {
          status: 'healthy',
          connected: true,
          metrics: mockCacheMetrics,
        },
        database: {
          status: 'healthy',
          queryTime: 25,
          queryStats: mockDbMetrics,
        },
        system: {
          nodeVersion: expect.any(String),
          uptime: expect.any(Number),
          memory: {
            used: expect.any(Number),
            total: expect.any(Number),
            external: expect.any(Number),
          },
        },
      });
    });

    test('returns 401 without admin key', async () => {
      const request = createMockRequest();

      const response = await GET({ request } as any);
      const responseData = await response.json();

      expect(response.status).toBe(401);
      expect(responseData.error).toBe('Unauthorized');
    });

    test('handles cache unavailable', async () => {
      mockCache.isHealthy.mockResolvedValue(false);
      mockCache.getMetrics.mockReturnValue({
        hits: 0,
        misses: 0,
        hitRatio: 0,
        sets: 0,
        deletes: 0,
        errors: 10,
      });

      mockDbOptimized.healthCheck.mockResolvedValue({ 
        status: 'healthy', 
        queryTime: 25,
      });

      const request = createMockRequest({
        headers: { 'authorization': 'Bearer test-admin-key' },
      });

      const response = await GET({ request } as any);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.cache.status).toBe('unhealthy');
      expect(responseData.cache.connected).toBe(false);
    });

    test('handles database issues', async () => {
      mockCache.isHealthy.mockResolvedValue(true);
      mockCache.getMetrics.mockReturnValue({
        hits: 100,
        misses: 20,
        hitRatio: 0.83,
        sets: 50,
        deletes: 10,
        errors: 0,
      });

      mockDbOptimized.healthCheck.mockRejectedValue(new Error('DB connection failed'));

      const request = createMockRequest({
        headers: { 'authorization': 'Bearer test-admin-key' },
      });

      const response = await GET({ request } as any);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.database.status).toBe('unhealthy');
    });

    test('calculates degraded cache status for low hit ratio', async () => {
      mockCache.isHealthy.mockResolvedValue(true);
      mockCache.getMetrics.mockReturnValue({
        hits: 400,
        misses: 600,
        hitRatio: 0.4, // Low hit ratio
        sets: 200,
        deletes: 50,
        errors: 5,
      });

      mockDbOptimized.healthCheck.mockResolvedValue({ 
        status: 'healthy', 
        queryTime: 25,
      });

      const request = createMockRequest({
        headers: { 'authorization': 'Bearer test-admin-key' },
      });

      const response = await GET({ request } as any);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.cache.status).toBe('degraded');
    });

    test('includes API performance metrics', async () => {
      mockCache.isHealthy.mockResolvedValue(true);
      mockCache.getMetrics.mockReturnValue({
        hits: 800,
        misses: 200,
        hitRatio: 0.8,
        sets: 150,
        deletes: 30,
        errors: 1,
      });

      mockDbOptimized.healthCheck.mockResolvedValue({ 
        status: 'healthy', 
        queryTime: 35,
      });

      const request = createMockRequest({
        headers: { 'authorization': 'Bearer test-admin-key' },
      });

      const response = await GET({ request } as any);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.api).toMatchObject({
        totalRequests: expect.any(Number),
        averageResponseTime: expect.any(Number),
        errorRate: expect.any(Number),
        slowRequestRate: expect.any(Number),
      });
    });
  });

  describe('POST /api/admin/performance', () => {
    test('records API metrics', async () => {
      const metricsData = {
        endpoint: '/api/wizard/save-answer',
        duration: 145,
        status: 200,
        method: 'POST',
        userAgent: 'Mozilla/5.0...',
      };

      const request = createMockRequest({
        method: 'POST',
        headers: { 
          'authorization': 'Bearer test-admin-key',
          'content-type': 'application/json',
        },
        body: metricsData,
      });

      const response = await POST({ request } as any);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Metrics recorded successfully');
    });

    test('validates required metrics fields', async () => {
      const invalidMetrics = {
        endpoint: '/api/test',
        // Missing duration and status
      };

      const request = createMockRequest({
        method: 'POST',
        headers: { 
          'authorization': 'Bearer test-admin-key',
          'content-type': 'application/json',
        },
        body: invalidMetrics,
      });

      const response = await POST({ request } as any);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Invalid metrics data');
    });

    test('handles bulk metrics recording', async () => {
      const bulkMetrics = {
        metrics: [
          {
            endpoint: '/api/wizard/save-answer',
            duration: 120,
            status: 200,
            timestamp: Date.now(),
          },
          {
            endpoint: '/api/chat/complete',
            duration: 250,
            status: 200,
            timestamp: Date.now(),
          },
          {
            endpoint: '/api/reports/generate',
            duration: 1200,
            status: 200,
            timestamp: Date.now(),
          },
        ],
      };

      const request = createMockRequest({
        method: 'POST',
        headers: { 
          'authorization': 'Bearer test-admin-key',
          'content-type': 'application/json',
        },
        body: bulkMetrics,
      });

      const response = await POST({ request } as any);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.recorded).toBe(3);
    });

    test('returns 401 without admin key', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { endpoint: '/api/test', duration: 100, status: 200 },
      });

      const response = await POST({ request } as any);
      const responseData = await response.json();

      expect(response.status).toBe(401);
      expect(responseData.error).toBe('Unauthorized');
    });

    test('handles malformed JSON', async () => {
      const request = {
        method: 'POST',
        url: 'http://localhost:3000/api/admin/performance',
        headers: {
          get: (name: string) => {
            if (name === 'authorization') return 'Bearer test-admin-key';
            if (name === 'content-type') return 'application/json';
            return null;
          },
        },
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as any;

      const response = await POST({ request } as any);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Invalid request body');
    });
  });

  describe('DELETE /api/admin/performance', () => {
    test('resets performance metrics', async () => {
      const request = createMockRequest({
        method: 'DELETE',
        headers: { 'authorization': 'Bearer test-admin-key' },
      });

      const response = await DELETE({ request } as any);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Performance metrics reset successfully');
    });

    test('returns 401 without admin key', async () => {
      const request = createMockRequest({
        method: 'DELETE',
      });

      const response = await DELETE({ request } as any);
      const responseData = await response.json();

      expect(response.status).toBe(401);
      expect(responseData.error).toBe('Unauthorized');
    });

    test('confirms reset operation', async () => {
      const request = createMockRequest({
        method: 'DELETE',
        headers: { 'authorization': 'Bearer test-admin-key' },
      });

      const response = await DELETE({ request } as any);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toMatchObject({
        success: true,
        message: 'Performance metrics reset successfully',
        resetAt: expect.any(String),
      });
    });
  });

  describe('performance calculations', () => {
    test('correctly calculates cache status based on metrics', async () => {
      // Test healthy cache (high hit ratio, low errors)
      mockCache.isHealthy.mockResolvedValue(true);
      mockCache.getMetrics.mockReturnValue({
        hits: 900,
        misses: 100,
        hitRatio: 0.9,
        sets: 200,
        deletes: 50,
        errors: 1,
      });

      mockDbOptimized.healthCheck.mockResolvedValue({ 
        status: 'healthy', 
        queryTime: 25,
      });

      const request = createMockRequest({
        headers: { 'authorization': 'Bearer test-admin-key' },
      });

      const response = await GET({ request } as any);
      const responseData = await response.json();

      expect(responseData.cache.status).toBe('healthy');
    });

    test('detects degraded performance', async () => {
      // Test degraded cache (moderate hit ratio, some errors)
      mockCache.isHealthy.mockResolvedValue(true);
      mockCache.getMetrics.mockReturnValue({
        hits: 650,
        misses: 350,
        hitRatio: 0.65,
        sets: 200,
        deletes: 50,
        errors: 8,
      });

      mockDbOptimized.healthCheck.mockResolvedValue({ 
        status: 'healthy', 
        queryTime: 75, // Slower query time
      });

      const request = createMockRequest({
        headers: { 'authorization': 'Bearer test-admin-key' },
      });

      const response = await GET({ request } as any);
      const responseData = await response.json();

      expect(responseData.cache.status).toBe('degraded');
    });

    test('includes request timing', async () => {
      mockCache.isHealthy.mockResolvedValue(true);
      mockCache.getMetrics.mockReturnValue({
        hits: 800,
        misses: 200,
        hitRatio: 0.8,
        sets: 150,
        deletes: 30,
        errors: 2,
      });

      mockDbOptimized.healthCheck.mockResolvedValue({ 
        status: 'healthy', 
        queryTime: 35,
      });

      const startTime = Date.now();
      const request = createMockRequest({
        headers: { 'authorization': 'Bearer test-admin-key' },
      });

      const response = await GET({ request } as any);
      const responseData = await response.json();
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(responseData.requestTime).toBeGreaterThan(0);
      expect(responseData.requestTime).toBeLessThan(endTime - startTime + 10); // Small margin
    });
  });

  describe('error handling', () => {
    test('handles missing environment variables', async () => {
      const originalKey = process.env.ADMIN_API_KEY;
      delete process.env.ADMIN_API_KEY;

      try {
        const request = createMockRequest({
          headers: { 'authorization': 'Bearer test-admin-key' },
        });

        const response = await GET({ request } as any);
        const responseData = await response.json();

        expect(response.status).toBe(401);
        expect(responseData.error).toBe('Unauthorized');
      } finally {
        process.env.ADMIN_API_KEY = originalKey;
      }
    });

    test('handles system resource calculation errors', async () => {
      mockCache.isHealthy.mockResolvedValue(true);
      mockCache.getMetrics.mockReturnValue({
        hits: 100,
        misses: 20,
        hitRatio: 0.83,
        sets: 50,
        deletes: 10,
        errors: 0,
      });

      mockDbOptimized.healthCheck.mockResolvedValue({ 
        status: 'healthy', 
        queryTime: 25,
      });

      // Mock process.memoryUsage to throw an error
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = vi.fn().mockImplementation(() => {
        throw new Error('Memory calculation failed');
      });

      try {
        const request = createMockRequest({
          headers: { 'authorization': 'Bearer test-admin-key' },
        });

        const response = await GET({ request } as any);
        const responseData = await response.json();

        expect(response.status).toBe(200);
        // Should still work with fallback values
        expect(responseData.system).toBeDefined();
      } finally {
        process.memoryUsage = originalMemoryUsage;
      }
    });

    test('handles concurrent requests gracefully', async () => {
      mockCache.isHealthy.mockResolvedValue(true);
      mockCache.getMetrics.mockReturnValue({
        hits: 500,
        misses: 100,
        hitRatio: 0.83,
        sets: 75,
        deletes: 15,
        errors: 1,
      });

      mockDbOptimized.healthCheck.mockResolvedValue({ 
        status: 'healthy', 
        queryTime: 30,
      });

      const request = createMockRequest({
        headers: { 'authorization': 'Bearer test-admin-key' },
      });

      // Make multiple concurrent requests
      const promises = Array(5).fill(null).map(() => GET({ request } as any));
      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});