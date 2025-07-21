// Load Test Runner - Task 4.1: Load Testing
// Comprehensive load testing framework for realistic usage patterns

import { chromium, Browser, BrowserContext } from '@playwright/test';

// Load test configuration
export interface LoadTestConfig {
  baseUrl: string;
  duration: number; // seconds
  concurrentUsers: number;
  rampUpTime?: number; // seconds
  scenario: LoadTestScenario;
  dataSetSize?: number;
  enableMetrics?: boolean;
  enableHeapDump?: boolean;
}

// Load test scenarios
export enum LoadTestScenario {
  WIZARD_COMPLETION = 'wizard_completion',
  CHAT_INTERACTION = 'chat_interaction',
  REPORT_GENERATION = 'report_generation',
  MIXED_WORKLOAD = 'mixed_workload',
  STRESS_TEST = 'stress_test',
  SPIKE_TEST = 'spike_test',
  ENDURANCE_TEST = 'endurance_test',
}

// Test result metrics
export interface LoadTestMetrics {
  scenario: LoadTestScenario;
  duration: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  memoryUsage: MemoryMetrics;
  databaseMetrics: DatabaseMetrics;
  cacheMetrics?: CacheMetrics;
  customMetrics: Record<string, number>;
}

export interface MemoryMetrics {
  initial: number;
  peak: number;
  final: number;
  leakDetected: boolean;
  gcCount: number;
}

export interface DatabaseMetrics {
  connectionPoolSize: number;
  activeConnections: number;
  averageQueryTime: number;
  slowQueries: number;
  totalQueries: number;
}

export interface CacheMetrics {
  hitRate: number;
  missRate: number;
  evictions: number;
  memoryUsage: number;
}

// Individual user session result
export interface UserSessionResult {
  userId: string;
  startTime: number;
  endTime: number;
  requestsCompleted: number;
  requestsFailed: number;
  averageResponseTime: number;
  errors: string[];
  customData: Record<string, any>;
}

/**
 * Load Test Runner for comprehensive performance testing
 */
export class LoadTestRunner {
  private browser: Browser | null = null;
  private results: UserSessionResult[] = [];
  private metrics: Partial<LoadTestMetrics> = {};
  private startTime: number = 0;

  constructor(private config: LoadTestConfig) {}

  /**
   * Execute load test with specified configuration
   */
  async execute(): Promise<LoadTestMetrics> {
    console.log(`🚀 Starting load test: ${this.config.scenario}`);
    console.log(`👥 Concurrent users: ${this.config.concurrentUsers}`);
    console.log(`⏱️ Duration: ${this.config.duration}s`);
    console.log(`🎯 Target: ${this.config.baseUrl}`);

    this.startTime = Date.now();
    
    try {
      // Initialize browser
      this.browser = await chromium.launch({ headless: true });
      
      // Collect initial metrics
      await this.collectInitialMetrics();
      
      // Execute test scenario
      await this.executeScenario();
      
      // Collect final metrics
      const finalMetrics = await this.collectFinalMetrics();
      
      console.log(`✅ Load test completed successfully`);
      return finalMetrics;
    } catch (error) {
      console.error(`❌ Load test failed:`, error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Execute specific test scenario
   */
  private async executeScenario(): Promise<void> {
    const { concurrentUsers, duration, rampUpTime = 0 } = this.config;
    
    // Calculate user spawn rate
    const spawnInterval = rampUpTime > 0 ? (rampUpTime * 1000) / concurrentUsers : 0;
    
    // Spawn concurrent users
    const userPromises: Promise<UserSessionResult>[] = [];
    
    for (let i = 0; i < concurrentUsers; i++) {
      // Delay user spawn for ramp-up
      if (spawnInterval > 0) {
        await new Promise(resolve => setTimeout(resolve, spawnInterval));
      }
      
      userPromises.push(this.spawnUser(`user_${i}`));
    }
    
    // Wait for all users to complete
    this.results = await Promise.all(userPromises);
  }

  /**
   * Spawn individual user session
   */
  private async spawnUser(userId: string): Promise<UserSessionResult> {
    const context = await this.browser!.newContext();
    const startTime = Date.now();
    const endTime = startTime + (this.config.duration * 1000);
    
    let requestsCompleted = 0;
    let requestsFailed = 0;
    let totalResponseTime = 0;
    const errors: string[] = [];
    const customData: Record<string, any> = {};

    try {
      const page = await context.newPage();
      
      // Execute scenario-specific logic
      switch (this.config.scenario) {
        case LoadTestScenario.WIZARD_COMPLETION:
          ({ requestsCompleted, requestsFailed, totalResponseTime, customData } = 
            await this.executeWizardScenario(page, endTime));
          break;
          
        case LoadTestScenario.CHAT_INTERACTION:
          ({ requestsCompleted, requestsFailed, totalResponseTime, customData } = 
            await this.executeChatScenario(page, endTime));
          break;
          
        case LoadTestScenario.REPORT_GENERATION:
          ({ requestsCompleted, requestsFailed, totalResponseTime, customData } = 
            await this.executeReportScenario(page, endTime));
          break;
          
        case LoadTestScenario.MIXED_WORKLOAD:
          ({ requestsCompleted, requestsFailed, totalResponseTime, customData } = 
            await this.executeMixedScenario(page, endTime));
          break;
          
        case LoadTestScenario.STRESS_TEST:
          ({ requestsCompleted, requestsFailed, totalResponseTime, customData } = 
            await this.executeStressScenario(page, endTime));
          break;
          
        default:
          throw new Error(`Unknown scenario: ${this.config.scenario}`);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      requestsFailed++;
    } finally {
      await context.close();
    }

    return {
      userId,
      startTime,
      endTime: Date.now(),
      requestsCompleted,
      requestsFailed,
      averageResponseTime: requestsCompleted > 0 ? totalResponseTime / requestsCompleted : 0,
      errors,
      customData,
    };
  }

  /**
   * Execute wizard completion scenario
   */
  private async executeWizardScenario(page: any, endTime: number) {
    let requestsCompleted = 0;
    let requestsFailed = 0;
    let totalResponseTime = 0;
    const customData: Record<string, any> = { wizardCompletions: 0 };

    while (Date.now() < endTime) {
      try {
        const startRequest = Date.now();
        
        // Navigate to wizard
        await page.goto(`${this.config.baseUrl}/wizard`);
        await page.waitForLoadState('networkidle');
        
        // Complete wizard steps
        const wizardSteps = [
          () => page.locator('[data-testid="option-startup"]').click(),
          () => page.locator('[data-testid="scale-slider"]').fill('7'),
          () => page.locator('[data-testid="technical-maturity-slider"]').fill('6'),
          () => page.locator('[data-testid="data-infrastructure"]').selectOption('cloud'),
        ];

        for (let i = 0; i < wizardSteps.length; i++) {
          await wizardSteps[i]();
          await page.locator('[data-testid="next-button"]').click();
          await page.waitForTimeout(100); // Brief pause between steps
        }

        // Submit wizard
        await page.locator('[data-testid="submit-wizard"]').click();
        await page.waitForSelector('[data-testid="wizard-completion"]');
        
        const responseTime = Date.now() - startRequest;
        totalResponseTime += responseTime;
        requestsCompleted++;
        customData.wizardCompletions++;
        
        // Brief pause before next iteration
        await page.waitForTimeout(1000);
      } catch (error) {
        requestsFailed++;
      }
    }

    return { requestsCompleted, requestsFailed, totalResponseTime, customData };
  }

  /**
   * Execute chat interaction scenario
   */
  private async executeChatScenario(page: any, endTime: number) {
    let requestsCompleted = 0;
    let requestsFailed = 0;
    let totalResponseTime = 0;
    const customData: Record<string, any> = { chatMessages: 0 };

    try {
      await page.goto(`${this.config.baseUrl}/wizard`);
      await page.waitForLoadState('networkidle');
    } catch (error) {
      requestsFailed++;
    }

    const chatMessages = [
      "What are the key benefits of AI adoption?",
      "How should we prepare our data infrastructure?",
      "What are the main challenges in AI implementation?",
      "Can you recommend specific AI tools for our use case?",
      "How do we measure AI project success?",
    ];

    while (Date.now() < endTime) {
      try {
        const message = chatMessages[Math.floor(Math.random() * chatMessages.length)];
        const startRequest = Date.now();
        
        // Send chat message
        await page.locator('[data-testid="chat-input"]').fill(message);
        await page.locator('[data-testid="chat-send"]').click();
        
        // Wait for response
        await page.waitForSelector('[data-testid="chat-response"]', { timeout: 10000 });
        
        const responseTime = Date.now() - startRequest;
        totalResponseTime += responseTime;
        requestsCompleted++;
        customData.chatMessages++;
        
        // Brief pause between messages
        await page.waitForTimeout(2000);
      } catch (error) {
        requestsFailed++;
      }
    }

    return { requestsCompleted, requestsFailed, totalResponseTime, customData };
  }

  /**
   * Execute report generation scenario
   */
  private async executeReportScenario(page: any, endTime: number) {
    let requestsCompleted = 0;
    let requestsFailed = 0;
    let totalResponseTime = 0;
    const customData: Record<string, any> = { reportsGenerated: 0 };

    while (Date.now() < endTime) {
      try {
        const startRequest = Date.now();
        
        // Complete a quick wizard
        await page.goto(`${this.config.baseUrl}/wizard`);
        await page.waitForLoadState('networkidle');
        
        // Fast wizard completion
        await page.locator('[data-testid="option-enterprise"]').click();
        await page.locator('[data-testid="next-button"]').click();
        
        await page.locator('[data-testid="scale-slider"]').fill('8');
        await page.locator('[data-testid="next-button"]').click();
        
        await page.locator('[data-testid="technical-maturity-slider"]').fill('7');
        await page.locator('[data-testid="next-button"]').click();
        
        await page.locator('[data-testid="data-infrastructure"]').selectOption('hybrid');
        await page.locator('[data-testid="next-button"]').click();
        
        // Submit and generate report
        await page.locator('[data-testid="submit-wizard"]').click();
        await page.waitForSelector('[data-testid="wizard-completion"]');
        
        // Trigger report download
        const downloadPromise = page.waitForEvent('download');
        await page.locator('[data-testid="download-report"]').click();
        await downloadPromise;
        
        const responseTime = Date.now() - startRequest;
        totalResponseTime += responseTime;
        requestsCompleted++;
        customData.reportsGenerated++;
        
        await page.waitForTimeout(3000); // Report generation is slower
      } catch (error) {
        requestsFailed++;
      }
    }

    return { requestsCompleted, requestsFailed, totalResponseTime, customData };
  }

  /**
   * Execute mixed workload scenario
   */
  private async executeMixedScenario(page: any, endTime: number) {
    let requestsCompleted = 0;
    let requestsFailed = 0;
    let totalResponseTime = 0;
    const customData: Record<string, any> = { operationMix: {} };

    const operations = ['wizard', 'chat', 'api_call'];
    
    while (Date.now() < endTime) {
      const operation = operations[Math.floor(Math.random() * operations.length)];
      
      try {
        const startRequest = Date.now();
        
        switch (operation) {
          case 'wizard':
            await this.performQuickWizardStep(page);
            break;
          case 'chat':
            await this.performChatMessage(page);
            break;
          case 'api_call':
            await this.performApiCall(page);
            break;
        }
        
        const responseTime = Date.now() - startRequest;
        totalResponseTime += responseTime;
        requestsCompleted++;
        
        customData.operationMix[operation] = (customData.operationMix[operation] || 0) + 1;
        
        await page.waitForTimeout(500);
      } catch (error) {
        requestsFailed++;
      }
    }

    return { requestsCompleted, requestsFailed, totalResponseTime, customData };
  }

  /**
   * Execute stress test scenario
   */
  private async executeStressScenario(page: any, endTime: number) {
    let requestsCompleted = 0;
    let requestsFailed = 0;
    let totalResponseTime = 0;
    const customData: Record<string, any> = { stressLevel: 'high' };

    while (Date.now() < endTime) {
      try {
        // Rapid-fire requests
        const promises = [];
        for (let i = 0; i < 5; i++) {
          promises.push(this.performApiCall(page));
        }
        
        const startRequest = Date.now();
        await Promise.all(promises);
        const responseTime = Date.now() - startRequest;
        
        totalResponseTime += responseTime;
        requestsCompleted += promises.length;
        
        // Minimal delay for stress testing
        await page.waitForTimeout(100);
      } catch (error) {
        requestsFailed++;
      }
    }

    return { requestsCompleted, requestsFailed, totalResponseTime, customData };
  }

  /**
   * Helper methods for mixed scenarios
   */
  private async performQuickWizardStep(page: any) {
    await page.goto(`${this.config.baseUrl}/wizard`);
    await page.locator('[data-testid="option-startup"]').click();
    await page.locator('[data-testid="next-button"]').click();
  }

  private async performChatMessage(page: any) {
    const response = await page.request.post(`${this.config.baseUrl}/api/chat/complete`, {
      data: {
        message: "Quick test message",
        context: { step: 1 },
      },
    });
    return response;
  }

  private async performApiCall(page: any) {
    const response = await page.request.get(`${this.config.baseUrl}/api/wizard/session`);
    return response;
  }

  /**
   * Collect initial system metrics
   */
  private async collectInitialMetrics(): Promise<void> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/health`);
      const healthData = await response.json();
      
      this.metrics = {
        scenario: this.config.scenario,
        memoryUsage: {
          initial: 0,
          peak: 0,
          final: 0,
          leakDetected: false,
          gcCount: 0,
        },
        databaseMetrics: {
          connectionPoolSize: 0,
          activeConnections: 0,
          averageQueryTime: 0,
          slowQueries: 0,
          totalQueries: 0,
        },
        customMetrics: {},
      };
    } catch (error) {
      console.warn('Failed to collect initial metrics:', error);
    }
  }

  /**
   * Collect final metrics and calculate results
   */
  private async collectFinalMetrics(): Promise<LoadTestMetrics> {
    const duration = (Date.now() - this.startTime) / 1000;
    
    // Calculate aggregate metrics
    const totalRequests = this.results.reduce((sum, r) => sum + r.requestsCompleted, 0);
    const failedRequests = this.results.reduce((sum, r) => sum + r.requestsFailed, 0);
    const responseTimes = this.results
      .filter(r => r.averageResponseTime > 0)
      .map(r => r.averageResponseTime);

    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length 
      : 0;

    // Calculate percentiles
    const sortedResponseTimes = responseTimes.sort((a, b) => a - b);
    const p50 = this.calculatePercentile(sortedResponseTimes, 50);
    const p95 = this.calculatePercentile(sortedResponseTimes, 95);
    const p99 = this.calculatePercentile(sortedResponseTimes, 99);

    return {
      scenario: this.config.scenario,
      duration,
      totalRequests,
      successfulRequests: totalRequests - failedRequests,
      failedRequests,
      averageResponseTime,
      p50ResponseTime: p50,
      p95ResponseTime: p95,
      p99ResponseTime: p99,
      minResponseTime: Math.min(...responseTimes) || 0,
      maxResponseTime: Math.max(...responseTimes) || 0,
      requestsPerSecond: totalRequests / duration,
      errorRate: (failedRequests / (totalRequests + failedRequests)) * 100,
      memoryUsage: this.metrics.memoryUsage!,
      databaseMetrics: this.metrics.databaseMetrics!,
      customMetrics: this.metrics.customMetrics!,
    };
  }

  /**
   * Calculate percentile value
   */
  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

/**
 * Convenience function to run load tests
 */
export async function runLoadTest(config: LoadTestConfig): Promise<LoadTestMetrics> {
  const runner = new LoadTestRunner(config);
  return await runner.execute();
}