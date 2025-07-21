// Performance Benchmarking - Task 3.3: Testing Suite
// Comprehensive performance benchmarks for critical system components

import { test, expect } from '@playwright/test';

interface BenchmarkResult {
  name: string;
  duration: number;
  operations: number;
  operationsPerSecond: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  memoryUsed?: number;
}

class PerformanceBenchmark {
  async runBenchmark(
    name: string,
    operation: () => Promise<any>,
    iterations: number = 100
  ): Promise<BenchmarkResult> {
    console.log(`🏁 Starting benchmark: ${name} (${iterations} iterations)`);
    
    const times: number[] = [];
    const startTime = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      const opStart = Date.now();
      try {
        await operation();
      } catch (error) {
        console.warn(`Benchmark operation failed on iteration ${i}:`, error);
      }
      const opEnd = Date.now();
      times.push(opEnd - opStart);
    }
    
    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    
    const result: BenchmarkResult = {
      name,
      duration: totalDuration,
      operations: iterations,
      operationsPerSecond: (iterations / totalDuration) * 1000,
      averageTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
    };
    
    console.log(`✅ Benchmark completed: ${name}`, {
      avgTime: `${result.averageTime.toFixed(2)}ms`,
      opsPerSec: `${result.operationsPerSecond.toFixed(2)} ops/sec`,
      range: `${result.minTime}ms - ${result.maxTime}ms`,
    });
    
    return result;
  }

  async measureMemory(page: any): Promise<number | null> {
    return await page.evaluate(() => {
      if ((performance as any).memory) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return null;
    });
  }
}

test.describe('Performance Benchmarks', () => {
  let benchmark: PerformanceBenchmark;

  test.beforeEach(async () => {
    benchmark = new PerformanceBenchmark();
  });

  test('wizard question rendering performance', async ({ page }) => {
    await page.goto('/wizard');
    
    const result = await benchmark.runBenchmark(
      'Wizard Question Rendering',
      async () => {
        await page.locator('[data-testid="next-button"]').click();
        await page.waitForSelector('[data-testid="question-container"]');
        await page.locator('[data-testid="back-button"]').click();
        await page.waitForSelector('[data-testid="question-container"]');
      },
      20
    );

    // Rendering performance requirements
    expect(result.averageTime).toBeLessThan(100); // Average under 100ms
    expect(result.maxTime).toBeLessThan(300); // Max under 300ms
    expect(result.operationsPerSecond).toBeGreaterThan(5); // At least 5 ops/sec
  });

  test('form validation performance', async ({ page }) => {
    await page.goto('/wizard');
    
    const result = await benchmark.runBenchmark(
      'Form Validation',
      async () => {
        // Trigger validation by submitting empty form
        await page.locator('[data-testid="next-button"]').click();
        await page.waitForSelector('[data-testid="validation-error"]');
        
        // Fill and validate
        await page.locator('[data-testid="option-startup"]').click();
        await page.locator('[data-testid="next-button"]').click();
      },
      30
    );

    // Validation should be near-instantaneous
    expect(result.averageTime).toBeLessThan(50); // Average under 50ms
    expect(result.maxTime).toBeLessThan(150); // Max under 150ms
    expect(result.operationsPerSecond).toBeGreaterThan(10); // At least 10 ops/sec
  });

  test('API response time benchmarks', async ({ page }) => {
    await page.goto('/');
    
    const sessionResult = await benchmark.runBenchmark(
      'Session API',
      async () => {
        const response = await page.request.get('/api/wizard/session');
        expect(response.ok()).toBe(true);
      },
      50
    );

    const questionsResult = await benchmark.runBenchmark(
      'Questions API',
      async () => {
        const response = await page.request.get('/api/wizard/questions');
        expect(response.ok()).toBe(true);
      },
      50
    );

    const saveAnswerResult = await benchmark.runBenchmark(
      'Save Answer API',
      async () => {
        const response = await page.request.post('/api/wizard/save-answer', {
          data: {
            step: 1,
            answer: 'startup',
            sessionId: 'benchmark-test',
          },
        });
        expect(response.ok()).toBe(true);
      },
      30
    );

    // API performance requirements
    expect(sessionResult.averageTime).toBeLessThan(200); // Session API under 200ms
    expect(questionsResult.averageTime).toBeLessThan(300); // Questions API under 300ms
    expect(saveAnswerResult.averageTime).toBeLessThan(500); // Save Answer API under 500ms
    
    expect(sessionResult.operationsPerSecond).toBeGreaterThan(5);
    expect(questionsResult.operationsPerSecond).toBeGreaterThan(3);
    expect(saveAnswerResult.operationsPerSecond).toBeGreaterThan(2);
  });

  test('dashboard loading performance', async ({ page }) => {
    await page.goto('/admin');
    
    const result = await benchmark.runBenchmark(
      'Dashboard Loading',
      async () => {
        await page.reload();
        await page.waitForSelector('[data-testid="dashboard-container"]');
        await page.waitForLoadState('networkidle');
      },
      10
    );

    // Dashboard should load reasonably fast
    expect(result.averageTime).toBeLessThan(2000); // Average under 2s
    expect(result.maxTime).toBeLessThan(5000); // Max under 5s
  });

  test('report generation performance', async ({ page }) => {
    await page.goto('/wizard');
    
    // Complete wizard first
    await page.locator('[data-testid="option-enterprise"]').click();
    await page.locator('[data-testid="next-button"]').click();
    await page.locator('[data-testid="scale-slider"]').fill('8');
    await page.locator('[data-testid="next-button"]').click();
    await page.locator('[data-testid="technical-maturity-slider"]').fill('7');
    await page.locator('[data-testid="next-button"]').click();
    await page.locator('[data-testid="data-infrastructure"]').selectOption('cloud');
    await page.locator('[data-testid="next-button"]').click();
    await page.locator('[data-testid="submit-wizard"]').click();
    
    const result = await benchmark.runBenchmark(
      'Report Generation',
      async () => {
        const downloadPromise = page.waitForEvent('download');
        await page.locator('[data-testid="download-report"]').click();
        await downloadPromise;
      },
      5 // Fewer iterations for expensive operations
    );

    // Report generation performance
    expect(result.averageTime).toBeLessThan(10000); // Average under 10s
    expect(result.maxTime).toBeLessThan(20000); // Max under 20s
  });

  test('search and filter performance', async ({ page }) => {
    await page.goto('/admin');
    
    const result = await benchmark.runBenchmark(
      'Search and Filter',
      async () => {
        // Simulate search operation
        await page.locator('[data-testid="search-input"]').fill('enterprise');
        await page.waitForTimeout(100); // Simulate debounce
        await page.locator('[data-testid="search-input"]').clear();
        
        // Simulate filter operation
        await page.locator('[data-testid="filter-dropdown"]').click();
        await page.locator('[data-testid="filter-option-completed"]').click();
        await page.locator('[data-testid="clear-filters"]').click();
      },
      25
    );

    // Search and filter should be responsive
    expect(result.averageTime).toBeLessThan(200); // Average under 200ms
    expect(result.maxTime).toBeLessThan(500); // Max under 500ms
    expect(result.operationsPerSecond).toBeGreaterThan(5);
  });

  test('memory usage during operations', async ({ page }) => {
    await page.goto('/wizard');
    
    const initialMemory = await benchmark.measureMemory(page);
    
    // Perform memory-intensive operations
    for (let i = 0; i < 10; i++) {
      await page.locator('[data-testid="option-enterprise"]').click();
      await page.locator('[data-testid="next-button"]').click();
      await page.locator('[data-testid="back-button"]').click();
    }
    
    const finalMemory = await benchmark.measureMemory(page);
    
    if (initialMemory && finalMemory) {
      const memoryGrowth = finalMemory - initialMemory;
      const growthPercentage = (memoryGrowth / initialMemory) * 100;
      
      console.log(`Memory usage: ${initialMemory} -> ${finalMemory} bytes (${growthPercentage.toFixed(1)}% growth)`);
      
      // Memory growth should be reasonable
      expect(growthPercentage).toBeLessThan(25); // Less than 25% growth
      expect(finalMemory).toBeLessThan(50 * 1024 * 1024); // Under 50MB
    }
  });

  test('concurrent operation performance', async ({ page }) => {
    await page.goto('/wizard');
    
    const result = await benchmark.runBenchmark(
      'Concurrent Operations',
      async () => {
        // Simulate multiple concurrent UI operations
        const promises = [
          page.locator('[data-testid="option-startup"]').click(),
          page.waitForSelector('[data-testid="progress-bar"]'),
          page.evaluate(() => window.scrollTo(0, 100)),
          page.locator('[data-testid="help-tooltip"]').hover(),
        ];
        
        await Promise.all(promises);
      },
      20
    );

    // Concurrent operations should not significantly impact performance
    expect(result.averageTime).toBeLessThan(300); // Average under 300ms
    expect(result.operationsPerSecond).toBeGreaterThan(3);
  });

  test('page transition performance', async ({ page }) => {
    await page.goto('/');
    
    const result = await benchmark.runBenchmark(
      'Page Transitions',
      async () => {
        await page.locator('a[href="/wizard"]').click();
        await page.waitForURL('**/wizard');
        await page.waitForSelector('[data-testid="wizard-container"]');
        
        await page.goBack();
        await page.waitForURL('/');
        await page.waitForSelector('[data-testid="hero-section"]');
      },
      15
    );

    // Page transitions should be smooth
    expect(result.averageTime).toBeLessThan(1000); // Average under 1s
    expect(result.maxTime).toBeLessThan(2500); // Max under 2.5s
  });

  test('data processing performance', async ({ page }) => {
    await page.goto('/admin');
    
    const result = await benchmark.runBenchmark(
      'Data Processing',
      async () => {
        // Simulate data processing operations
        await page.evaluate(() => {
          // Simulate client-side data processing
          const data = Array.from({ length: 1000 }, (_, i) => ({
            id: i,
            value: Math.random() * 100,
            category: ['A', 'B', 'C'][i % 3],
          }));
          
          // Sort and filter operations
          const processed = data
            .filter(item => item.value > 50)
            .sort((a, b) => b.value - a.value)
            .slice(0, 100);
          
          return processed.length;
        });
      },
      50
    );

    // Data processing should be efficient
    expect(result.averageTime).toBeLessThan(100); // Average under 100ms
    expect(result.operationsPerSecond).toBeGreaterThan(10);
  });

  test('image and asset loading performance', async ({ page }) => {
    const result = await benchmark.runBenchmark(
      'Asset Loading',
      async () => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        // Check that images are loaded
        const images = await page.locator('img').count();
        if (images > 0) {
          await page.locator('img').first().waitFor({ state: 'visible' });
        }
      },
      10
    );

    // Asset loading should be reasonably fast
    expect(result.averageTime).toBeLessThan(3000); // Average under 3s
    expect(result.maxTime).toBeLessThan(8000); // Max under 8s
  });

  test('form submission performance', async ({ page }) => {
    await page.goto('/wizard');
    
    const result = await benchmark.runBenchmark(
      'Form Submission',
      async () => {
        await page.locator('[data-testid="option-enterprise"]').click();
        await page.locator('[data-testid="next-button"]').click();
        await page.waitForSelector('[data-testid="step-counter"]');
        await page.locator('[data-testid="back-button"]').click();
      },
      25
    );

    // Form submission should be responsive
    expect(result.averageTime).toBeLessThan(400); // Average under 400ms
    expect(result.maxTime).toBeLessThan(1000); // Max under 1s
    expect(result.operationsPerSecond).toBeGreaterThan(4);
  });

  test('overall system responsiveness', async ({ page }) => {
    await page.goto('/');
    
    const result = await benchmark.runBenchmark(
      'System Responsiveness',
      async () => {
        // Comprehensive system interaction
        await page.locator('[data-testid="start-wizard-guest"]').click();
        await page.waitForSelector('[data-testid="wizard-container"]');
        
        await page.locator('[data-testid="option-startup"]').click();
        await page.locator('[data-testid="next-button"]').click();
        
        await page.locator('[data-testid="scale-slider"]').fill('5');
        await page.locator('[data-testid="next-button"]').click();
        
        await page.locator('[data-testid="back-button"]').click();
        await page.locator('[data-testid="back-button"]').click();
      },
      10
    );

    // Overall system should be responsive
    expect(result.averageTime).toBeLessThan(2000); // Average under 2s
    expect(result.maxTime).toBeLessThan(5000); // Max under 5s
    expect(result.operationsPerSecond).toBeGreaterThan(0.5); // At least 0.5 ops/sec
  });
});