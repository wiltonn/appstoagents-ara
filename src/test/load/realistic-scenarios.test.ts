// Realistic Load Testing Scenarios - Task 4.1: Load Testing
// Production-like scenarios for comprehensive load testing

import { test, expect } from '@playwright/test';
import { runLoadTest, LoadTestConfig, LoadTestScenario } from './load-test-runner';

// Test configuration constants
const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const LOAD_TEST_DURATION = parseInt(process.env.LOAD_TEST_DURATION || '60'); // seconds
const MAX_CONCURRENT_USERS = parseInt(process.env.MAX_CONCURRENT_USERS || '100');

test.describe('Realistic Load Testing Scenarios', () => {
  test.setTimeout(300000); // 5 minutes timeout for load tests

  test('Scenario 1: Normal Business Hours Load', async () => {
    console.log('🏢 Testing normal business hours load pattern...');
    
    const config: LoadTestConfig = {
      baseUrl: BASE_URL,
      duration: LOAD_TEST_DURATION,
      concurrentUsers: 25, // Moderate concurrent users
      rampUpTime: 30, // 30 second ramp-up
      scenario: LoadTestScenario.MIXED_WORKLOAD,
      enableMetrics: true,
    };

    const results = await runLoadTest(config);

    // Validate normal load performance
    expect(results.errorRate).toBeLessThan(2); // Less than 2% error rate
    expect(results.averageResponseTime).toBeLessThan(1000); // Under 1 second average
    expect(results.p95ResponseTime).toBeLessThan(2000); // 95th percentile under 2 seconds
    expect(results.requestsPerSecond).toBeGreaterThan(10); // At least 10 RPS

    console.log('📊 Normal Business Hours Results:', {
      totalRequests: results.totalRequests,
      errorRate: `${results.errorRate.toFixed(2)}%`,
      avgResponseTime: `${results.averageResponseTime.toFixed(0)}ms`,
      p95ResponseTime: `${results.p95ResponseTime.toFixed(0)}ms`,
      requestsPerSecond: results.requestsPerSecond.toFixed(2),
    });
  });

  test('Scenario 2: Peak Traffic Load (100 concurrent users)', async () => {
    console.log('🚀 Testing peak traffic load with 100 concurrent users...');
    
    const config: LoadTestConfig = {
      baseUrl: BASE_URL,
      duration: LOAD_TEST_DURATION,
      concurrentUsers: MAX_CONCURRENT_USERS,
      rampUpTime: 60, // 1 minute ramp-up for peak load
      scenario: LoadTestScenario.WIZARD_COMPLETION,
      enableMetrics: true,
    };

    const results = await runLoadTest(config);

    // Validate peak load performance (acceptance criteria)
    expect(results.errorRate).toBeLessThan(5); // Less than 5% error rate under peak load
    expect(results.averageResponseTime).toBeLessThan(2000); // Under 2 seconds average
    expect(results.p99ResponseTime).toBeLessThan(5000); // 99th percentile under 5 seconds
    expect(results.requestsPerSecond).toBeGreaterThan(20); // At least 20 RPS under load

    console.log('📊 Peak Traffic Results:', {
      totalRequests: results.totalRequests,
      errorRate: `${results.errorRate.toFixed(2)}%`,
      avgResponseTime: `${results.averageResponseTime.toFixed(0)}ms`,
      p99ResponseTime: `${results.p99ResponseTime.toFixed(0)}ms`,
      requestsPerSecond: results.requestsPerSecond.toFixed(2),
    });

    // Validate no system degradation under peak load
    expect(results.memoryUsage.leakDetected).toBe(false);
  });

  test('Scenario 3: Wizard Completion Load Pattern', async () => {
    console.log('📝 Testing wizard completion focused load...');
    
    const config: LoadTestConfig = {
      baseUrl: BASE_URL,
      duration: LOAD_TEST_DURATION,
      concurrentUsers: 50,
      rampUpTime: 20,
      scenario: LoadTestScenario.WIZARD_COMPLETION,
      enableMetrics: true,
    };

    const results = await runLoadTest(config);

    // Wizard-specific performance requirements
    expect(results.errorRate).toBeLessThan(1); // Very low error rate for core flow
    expect(results.averageResponseTime).toBeLessThan(1500); // Under 1.5 seconds
    expect(results.p95ResponseTime).toBeLessThan(3000); // 95th percentile under 3 seconds

    console.log('📊 Wizard Completion Results:', {
      totalRequests: results.totalRequests,
      errorRate: `${results.errorRate.toFixed(2)}%`,
      avgResponseTime: `${results.averageResponseTime.toFixed(0)}ms`,
      p95ResponseTime: `${results.p95ResponseTime.toFixed(0)}ms`,
      customMetrics: results.customMetrics,
    });
  });

  test('Scenario 4: Chat Interaction Load', async () => {
    console.log('💬 Testing chat interaction load pattern...');
    
    const config: LoadTestConfig = {
      baseUrl: BASE_URL,
      duration: LOAD_TEST_DURATION,
      concurrentUsers: 30,
      rampUpTime: 15,
      scenario: LoadTestScenario.CHAT_INTERACTION,
      enableMetrics: true,
    };

    const results = await runLoadTest(config);

    // Chat-specific performance requirements (AI calls are slower)
    expect(results.errorRate).toBeLessThan(3); // Slightly higher tolerance for AI calls
    expect(results.averageResponseTime).toBeLessThan(3000); // Under 3 seconds for AI
    expect(results.p95ResponseTime).toBeLessThan(6000); // 95th percentile under 6 seconds

    console.log('📊 Chat Interaction Results:', {
      totalRequests: results.totalRequests,
      errorRate: `${results.errorRate.toFixed(2)}%`,
      avgResponseTime: `${results.averageResponseTime.toFixed(0)}ms`,
      p95ResponseTime: `${results.p95ResponseTime.toFixed(0)}ms`,
      customMetrics: results.customMetrics,
    });
  });

  test('Scenario 5: Report Generation Load', async () => {
    console.log('📄 Testing report generation load pattern...');
    
    const config: LoadTestConfig = {
      baseUrl: BASE_URL,
      duration: LOAD_TEST_DURATION,
      concurrentUsers: 20, // Lower concurrency for resource-intensive operations
      rampUpTime: 30,
      scenario: LoadTestScenario.REPORT_GENERATION,
      enableMetrics: true,
    };

    const results = await runLoadTest(config);

    // Report generation performance requirements
    expect(results.errorRate).toBeLessThan(5); // Report generation can be resource intensive
    expect(results.averageResponseTime).toBeLessThan(10000); // Under 10 seconds average
    expect(results.p95ResponseTime).toBeLessThan(20000); // 95th percentile under 20 seconds

    console.log('📊 Report Generation Results:', {
      totalRequests: results.totalRequests,
      errorRate: `${results.errorRate.toFixed(2)}%`,
      avgResponseTime: `${results.averageResponseTime.toFixed(0)}ms`,
      p95ResponseTime: `${results.p95ResponseTime.toFixed(0)}ms`,
      customMetrics: results.customMetrics,
    });
  });

  test('Scenario 6: Stress Test - Beyond Normal Capacity', async () => {
    console.log('⚡ Testing stress conditions beyond normal capacity...');
    
    const config: LoadTestConfig = {
      baseUrl: BASE_URL,
      duration: Math.min(LOAD_TEST_DURATION, 120), // Limit stress test duration
      concurrentUsers: Math.min(MAX_CONCURRENT_USERS * 1.5, 150), // 50% above normal capacity
      rampUpTime: 10, // Fast ramp-up for stress testing
      scenario: LoadTestScenario.STRESS_TEST,
      enableMetrics: true,
    };

    const results = await runLoadTest(config);

    // Stress test - expect some degradation but not complete failure
    expect(results.errorRate).toBeLessThan(15); // Higher error tolerance under stress
    expect(results.successfulRequests).toBeGreaterThan(results.totalRequests * 0.7); // At least 70% success
    
    // System should still respond, even if slower
    if (results.successfulRequests > 0) {
      expect(results.averageResponseTime).toBeLessThan(10000); // Under 10 seconds even under stress
    }

    console.log('📊 Stress Test Results:', {
      totalRequests: results.totalRequests,
      successfulRequests: results.successfulRequests,
      errorRate: `${results.errorRate.toFixed(2)}%`,
      avgResponseTime: `${results.averageResponseTime.toFixed(0)}ms`,
      systemStillResponsive: results.successfulRequests > 0,
    });

    // Validate no memory leaks under stress
    expect(results.memoryUsage.leakDetected).toBe(false);
  });

  test('Scenario 7: Spike Test - Sudden Traffic Increase', async () => {
    console.log('📈 Testing spike traffic pattern...');
    
    const config: LoadTestConfig = {
      baseUrl: BASE_URL,
      duration: LOAD_TEST_DURATION,
      concurrentUsers: 75,
      rampUpTime: 5, // Very fast ramp-up to simulate traffic spike
      scenario: LoadTestScenario.SPIKE_TEST,
      enableMetrics: true,
    };

    const results = await runLoadTest(config);

    // Spike test - system should handle sudden load increases
    expect(results.errorRate).toBeLessThan(10); // Some errors expected during spike
    expect(results.successfulRequests).toBeGreaterThan(results.totalRequests * 0.8); // At least 80% success

    console.log('📊 Spike Test Results:', {
      totalRequests: results.totalRequests,
      errorRate: `${results.errorRate.toFixed(2)}%`,
      avgResponseTime: `${results.averageResponseTime.toFixed(0)}ms`,
      handledSpike: results.errorRate < 10,
    });
  });

  test('Scenario 8: Endurance Test - Extended Duration', async () => {
    console.log('⏰ Testing system endurance over extended period...');
    
    const config: LoadTestConfig = {
      baseUrl: BASE_URL,
      duration: Math.max(LOAD_TEST_DURATION * 2, 300), // At least 5 minutes
      concurrentUsers: 40, // Moderate load for extended duration
      rampUpTime: 60,
      scenario: LoadTestScenario.ENDURANCE_TEST,
      enableMetrics: true,
      enableHeapDump: true,
    };

    const results = await runLoadTest(config);

    // Endurance test - validate no degradation over time
    expect(results.errorRate).toBeLessThan(3); // Low error rate over time
    expect(results.averageResponseTime).toBeLessThan(2000); // Consistent response times
    expect(results.memoryUsage.leakDetected).toBe(false); // No memory leaks

    console.log('📊 Endurance Test Results:', {
      duration: `${results.duration.toFixed(0)}s`,
      totalRequests: results.totalRequests,
      errorRate: `${results.errorRate.toFixed(2)}%`,
      avgResponseTime: `${results.averageResponseTime.toFixed(0)}ms`,
      memoryStable: !results.memoryUsage.leakDetected,
    });
  });

  test('Scenario 9: Mixed Realistic Workload', async () => {
    console.log('🔄 Testing mixed realistic workload pattern...');
    
    const config: LoadTestConfig = {
      baseUrl: BASE_URL,
      duration: LOAD_TEST_DURATION,
      concurrentUsers: 60,
      rampUpTime: 45,
      scenario: LoadTestScenario.MIXED_WORKLOAD,
      enableMetrics: true,
    };

    const results = await runLoadTest(config);

    // Mixed workload - representative of real usage
    expect(results.errorRate).toBeLessThan(2); // Low error rate for mixed operations
    expect(results.averageResponseTime).toBeLessThan(2000); // Under 2 seconds average
    expect(results.requestsPerSecond).toBeGreaterThan(15); // Good throughput

    console.log('📊 Mixed Workload Results:', {
      totalRequests: results.totalRequests,
      errorRate: `${results.errorRate.toFixed(2)}%`,
      avgResponseTime: `${results.averageResponseTime.toFixed(0)}ms`,
      requestsPerSecond: results.requestsPerSecond.toFixed(2),
      customMetrics: results.customMetrics,
    });
  });

  test('Performance Baseline Comparison', async () => {
    console.log('📏 Establishing performance baseline...');
    
    // Run a lightweight baseline test
    const baselineConfig: LoadTestConfig = {
      baseUrl: BASE_URL,
      duration: 30,
      concurrentUsers: 10,
      scenario: LoadTestScenario.WIZARD_COMPLETION,
      enableMetrics: true,
    };

    const baseline = await runLoadTest(baselineConfig);

    // Record baseline metrics for comparison
    console.log('📊 Performance Baseline:', {
      baselineResponseTime: `${baseline.averageResponseTime.toFixed(0)}ms`,
      baselineRPS: baseline.requestsPerSecond.toFixed(2),
      baselineErrorRate: `${baseline.errorRate.toFixed(2)}%`,
    });

    // Baseline validation
    expect(baseline.errorRate).toBeLessThan(1); // Baseline should be very stable
    expect(baseline.averageResponseTime).toBeLessThan(500); // Fast response under light load
    expect(baseline.requestsPerSecond).toBeGreaterThan(5); // Reasonable throughput

    // Store baseline for future comparisons
    await this.storeBaseline(baseline);
  });

  // Helper method to store baseline results
  private async storeBaseline(baseline: any) {
    // This would typically store baseline metrics in a database or file
    // for future regression testing and performance monitoring
    console.log('💾 Baseline metrics stored for future comparison');
  }
});