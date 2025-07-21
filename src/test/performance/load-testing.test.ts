// Load Testing - Task 3.3: Testing Suite
// Performance testing with load scenarios for critical endpoints

import { test, expect } from '@playwright/test';

interface LoadTestResult {
  url: string;
  method: string;
  responseTime: number;
  status: number;
  success: boolean;
  timestamp: number;
}

interface LoadTestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
}

class LoadTester {
  private results: LoadTestResult[] = [];

  async runConcurrentRequests(
    page: any,
    url: string,
    method: string = 'GET',
    concurrency: number = 10,
    duration: number = 30000, // 30 seconds
    payload?: any
  ): Promise<LoadTestMetrics> {
    const startTime = Date.now();
    const endTime = startTime + duration;
    
    console.log(`🔄 Starting load test: ${method} ${url} - ${concurrency} concurrent users for ${duration/1000}s`);

    // Run concurrent requests
    const promises: Promise<void>[] = [];
    
    for (let i = 0; i < concurrency; i++) {
      promises.push(this.runRequestLoop(page, url, method, endTime, payload));
    }

    await Promise.all(promises);

    return this.calculateMetrics();
  }

  private async runRequestLoop(
    page: any,
    url: string,
    method: string,
    endTime: number,
    payload?: any
  ): Promise<void> {
    while (Date.now() < endTime) {
      try {
        const requestStart = Date.now();
        
        let response;
        if (method === 'POST' && payload) {
          response = await page.request.post(url, {
            data: payload,
            headers: {
              'Content-Type': 'application/json',
            },
          });
        } else {
          response = await page.request.get(url);
        }

        const responseTime = Date.now() - requestStart;
        
        this.results.push({
          url,
          method,
          responseTime,
          status: response.status(),
          success: response.ok(),
          timestamp: requestStart,
        });

        // Small delay to prevent overwhelming the server
        await page.waitForTimeout(100);
      } catch (error) {
        this.results.push({
          url,
          method,
          responseTime: -1,
          status: 0,
          success: false,
          timestamp: Date.now(),
        });
      }
    }
  }

  private calculateMetrics(): LoadTestMetrics {
    if (this.results.length === 0) {
      throw new Error('No results to calculate metrics from');
    }

    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);
    const responseTimes = successful.map(r => r.responseTime).sort((a, b) => a - b);

    const totalDuration = Math.max(...this.results.map(r => r.timestamp)) - 
                         Math.min(...this.results.map(r => r.timestamp));
    
    const metrics: LoadTestMetrics = {
      totalRequests: this.results.length,
      successfulRequests: successful.length,
      failedRequests: failed.length,
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0,
      minResponseTime: Math.min(...responseTimes) || 0,
      maxResponseTime: Math.max(...responseTimes) || 0,
      requestsPerSecond: (this.results.length / totalDuration) * 1000,
      p95ResponseTime: this.getPercentile(responseTimes, 95),
      p99ResponseTime: this.getPercentile(responseTimes, 99),
      errorRate: (failed.length / this.results.length) * 100,
    };

    console.log('📊 Load Test Results:', metrics);
    return metrics;
  }

  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)] || 0;
  }

  reset(): void {
    this.results = [];
  }
}

test.describe('Performance Load Testing', () => {
  let loadTester: LoadTester;

  test.beforeEach(async () => {
    loadTester = new LoadTester();
  });

  test('wizard endpoint handles moderate load', async ({ page }) => {
    await page.goto('/');
    
    const wizardPayload = {
      step: 1,
      answers: {
        companySize: 'startup',
        currentAI: 'minimal',
      },
      sessionId: 'load-test-session',
    };

    const metrics = await loadTester.runConcurrentRequests(
      page,
      '/api/wizard/save-answer',
      'POST',
      5, // 5 concurrent users
      15000, // 15 seconds
      wizardPayload
    );

    // Performance assertions
    expect(metrics.errorRate).toBeLessThan(5); // Less than 5% error rate
    expect(metrics.averageResponseTime).toBeLessThan(500); // Average under 500ms
    expect(metrics.p95ResponseTime).toBeLessThan(1000); // 95th percentile under 1s
    expect(metrics.p99ResponseTime).toBeLessThan(2000); // 99th percentile under 2s
    expect(metrics.requestsPerSecond).toBeGreaterThan(2); // At least 2 RPS
  });

  test('chat completion endpoint performance under load', async ({ page }) => {
    await page.goto('/wizard');
    
    const chatPayload = {
      message: 'What are the key considerations for AI adoption in startups?',
      context: {
        companySize: 'startup',
        currentMaturity: 3,
        goals: ['efficiency', 'automation'],
      },
      sessionId: 'load-test-chat',
    };

    const metrics = await loadTester.runConcurrentRequests(
      page,
      '/api/chat/complete',
      'POST',
      3, // 3 concurrent users (lighter load due to AI processing)
      20000, // 20 seconds
      chatPayload
    );

    // More lenient performance for AI endpoints
    expect(metrics.errorRate).toBeLessThan(10); // Less than 10% error rate
    expect(metrics.averageResponseTime).toBeLessThan(3000); // Average under 3s
    expect(metrics.p95ResponseTime).toBeLessThan(5000); // 95th percentile under 5s
    expect(metrics.successfulRequests).toBeGreaterThan(10); // At least 10 successful requests
  });

  test('report generation endpoint handles concurrent requests', async ({ page }) => {
    await page.goto('/wizard');
    
    const reportPayload = {
      responses: {
        companySize: 'enterprise',
        aiUsage: 8,
        technicalMaturity: 7,
        dataInfrastructure: 'cloud',
        goals: ['efficiency', 'innovation', 'competitive-advantage'],
      },
      format: 'pdf',
      includeRecommendations: true,
    };

    const metrics = await loadTester.runConcurrentRequests(
      page,
      '/api/reports/generate',
      'POST',
      2, // 2 concurrent users (resource intensive)
      25000, // 25 seconds
      reportPayload
    );

    // Performance for resource-intensive operations
    expect(metrics.errorRate).toBeLessThan(15); // Less than 15% error rate
    expect(metrics.averageResponseTime).toBeLessThan(5000); // Average under 5s
    expect(metrics.p99ResponseTime).toBeLessThan(10000); // 99th percentile under 10s
    expect(metrics.successfulRequests).toBeGreaterThan(5); // At least 5 successful requests
  });

  test('static asset loading performance', async ({ page }) => {
    const metrics = await loadTester.runConcurrentRequests(
      page,
      '/',
      'GET',
      10, // 10 concurrent users
      10000 // 10 seconds
    );

    // Static assets should be very fast
    expect(metrics.errorRate).toBeLessThan(2); // Less than 2% error rate
    expect(metrics.averageResponseTime).toBeLessThan(200); // Average under 200ms
    expect(metrics.p95ResponseTime).toBeLessThan(500); // 95th percentile under 500ms
    expect(metrics.requestsPerSecond).toBeGreaterThan(5); // At least 5 RPS
  });

  test('API endpoint resilience under stress', async ({ page }) => {
    await page.goto('/');
    
    // High load stress test
    const metrics = await loadTester.runConcurrentRequests(
      page,
      '/api/wizard/session',
      'GET',
      15, // 15 concurrent users (stress test)
      20000 // 20 seconds
    );

    // Stress test - expect some degradation but not complete failure
    expect(metrics.errorRate).toBeLessThan(25); // Less than 25% error rate under stress
    expect(metrics.successfulRequests).toBeGreaterThan(20); // At least 20 successful requests
    expect(metrics.averageResponseTime).toBeLessThan(2000); // Average under 2s even under stress
  });

  test('database connection handling under load', async ({ page }) => {
    await page.goto('/admin');
    
    // Simulate multiple dashboard requests
    const metrics = await loadTester.runConcurrentRequests(
      page,
      '/api/admin/performance',
      'GET',
      8, // 8 concurrent admin users
      15000 // 15 seconds
    );

    // Database-heavy operations
    expect(metrics.errorRate).toBeLessThan(10); // Less than 10% error rate
    expect(metrics.averageResponseTime).toBeLessThan(1000); // Average under 1s
    expect(metrics.p95ResponseTime).toBeLessThan(2000); // 95th percentile under 2s
  });

  test('memory usage remains stable during load', async ({ page }) => {
    await page.goto('/');
    
    // Monitor memory during load test
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory ? {
        used: (performance as any).memory.usedJSHeapSize,
        total: (performance as any).memory.totalJSHeapSize,
        limit: (performance as any).memory.jsHeapSizeLimit,
      } : null;
    });

    // Run load test
    await loadTester.runConcurrentRequests(
      page,
      '/api/wizard/session',
      'GET',
      10,
      15000
    );

    const finalMemory = await page.evaluate(() => {
      return (performance as any).memory ? {
        used: (performance as any).memory.usedJSHeapSize,
        total: (performance as any).memory.totalJSHeapSize,
        limit: (performance as any).memory.jsHeapSizeLimit,
      } : null;
    });

    if (initialMemory && finalMemory) {
      const memoryGrowth = finalMemory.used - initialMemory.used;
      const growthPercentage = (memoryGrowth / initialMemory.used) * 100;
      
      // Memory growth should be reasonable
      expect(growthPercentage).toBeLessThan(50); // Less than 50% memory growth
      expect(finalMemory.used).toBeLessThan(finalMemory.limit * 0.8); // Under 80% of limit
    }
  });

  test('response time consistency across load', async ({ page }) => {
    await page.goto('/');
    
    const metrics = await loadTester.runConcurrentRequests(
      page,
      '/api/wizard/questions',
      'GET',
      6, // 6 concurrent users
      20000 // 20 seconds
    );

    // Response time consistency
    const responseTimeRange = metrics.maxResponseTime - metrics.minResponseTime;
    const consistencyRatio = responseTimeRange / metrics.averageResponseTime;
    
    expect(consistencyRatio).toBeLessThan(5); // Response times shouldn't vary by more than 5x
    expect(metrics.p99ResponseTime / metrics.p95ResponseTime).toBeLessThan(2); // P99 shouldn't be more than 2x P95
  });

  test('concurrent user session handling', async ({ page }) => {
    await page.goto('/wizard');
    
    // Test multiple sessions with different user data
    const userPayloads = Array.from({ length: 5 }, (_, i) => ({
      step: 1,
      answers: { companySize: i % 2 === 0 ? 'startup' : 'enterprise' },
      sessionId: `load-test-user-${i}`,
    }));

    const results = await Promise.all(
      userPayloads.map(async (payload, index) => {
        loadTester.reset();
        return await loadTester.runConcurrentRequests(
          page,
          '/api/wizard/save-answer',
          'POST',
          1, // 1 user per session
          5000, // 5 seconds
          payload
        );
      })
    );

    // All sessions should perform well
    results.forEach((metrics, index) => {
      expect(metrics.errorRate, `Session ${index} error rate`).toBeLessThan(5);
      expect(metrics.averageResponseTime, `Session ${index} response time`).toBeLessThan(500);
    });
  });

  test('graceful degradation under extreme load', async ({ page }) => {
    await page.goto('/');
    
    // Extreme load test to verify graceful degradation
    const metrics = await loadTester.runConcurrentRequests(
      page,
      '/api/wizard/session',
      'GET',
      25, // 25 concurrent users (extreme load)
      15000 // 15 seconds
    );

    // Under extreme load, expect degradation but not complete failure
    expect(metrics.successfulRequests).toBeGreaterThan(10); // At least some requests succeed
    expect(metrics.errorRate).toBeLessThan(50); // Not more than 50% failure rate
    
    // System should still respond, even if slower
    if (metrics.successfulRequests > 0) {
      expect(metrics.averageResponseTime).toBeLessThan(5000); // Still under 5s average
    }
  });
});