// Scalability Assessment - Task 4.1: Load Testing
// Comprehensive scalability testing and bottleneck identification

import { runLoadTest, LoadTestConfig, LoadTestScenario, LoadTestMetrics } from './load-test-runner';
import { runDatabaseLoadTest, DatabaseLoadConfig, DatabaseScenario, DatabaseLoadMetrics } from './database-load-testing';

// Scalability test configuration
export interface ScalabilityTestConfig {
  baseUrl: string;
  startUsers: number;
  maxUsers: number;
  stepSize: number;
  stepDuration: number; // seconds
  enableDatabaseTesting: boolean;
  enableMemoryProfiling: boolean;
  enableBottleneckAnalysis: boolean;
}

// Scalability test results
export interface ScalabilityTestResults {
  testConfig: ScalabilityTestConfig;
  loadTestResults: LoadTestMetrics[];
  databaseTestResults?: DatabaseLoadMetrics[];
  scalabilityMetrics: ScalabilityMetrics;
  bottlenecks: BottleneckAnalysis;
  recommendations: ScalabilityRecommendations;
}

// Scalability metrics
export interface ScalabilityMetrics {
  maxSupportedUsers: number;
  degradationPoint: number; // user count where performance degrades
  linearScalingRange: number; // user count with linear scaling
  memoryGrowthRate: number; // MB per additional user
  cpuUtilizationTrend: number; // % increase per additional user
  responseTimeGrowth: ResponseTimeGrowth;
  throughputScaling: ThroughputScaling;
  resourceUtilization: ResourceUtilization;
}

export interface ResponseTimeGrowth {
  linear: boolean;
  exponential: boolean;
  growthFactor: number; // ms increase per additional user
}

export interface ThroughputScaling {
  maxThroughput: number; // requests per second
  optimalUserCount: number;
  scalingEfficiency: number; // percentage of linear scaling achieved
}

export interface ResourceUtilization {
  memory: ResourceMetric;
  cpu: ResourceMetric;
  database: ResourceMetric;
  network: ResourceMetric;
}

export interface ResourceMetric {
  current: number;
  maximum: number;
  utilizationPercentage: number;
  bottleneckRisk: 'low' | 'medium' | 'high' | 'critical';
}

// Bottleneck analysis
export interface BottleneckAnalysis {
  primaryBottleneck: BottleneckType;
  secondaryBottlenecks: BottleneckType[];
  severityScore: number; // 1-10 scale
  impactAssessment: BottleneckImpact;
  mitigationStrategies: string[];
}

export enum BottleneckType {
  CPU = 'cpu',
  MEMORY = 'memory',
  DATABASE_CONNECTIONS = 'database_connections',
  DATABASE_QUERIES = 'database_queries',
  NETWORK_IO = 'network_io',
  AI_API_LIMITS = 'ai_api_limits',
  AUTHENTICATION = 'authentication',
  FILE_STORAGE = 'file_storage',
  CACHE = 'cache',
}

export interface BottleneckImpact {
  userExperience: 'minimal' | 'moderate' | 'significant' | 'severe';
  systemStability: 'stable' | 'degraded' | 'unstable' | 'critical';
  businessImpact: 'low' | 'medium' | 'high' | 'critical';
}

// Scalability recommendations
export interface ScalabilityRecommendations {
  immediateActions: RecommendationAction[];
  shortTermOptimizations: RecommendationAction[];
  longTermStrategies: RecommendationAction[];
  infrastructureNeeds: InfrastructureRecommendation[];
}

export interface RecommendationAction {
  category: 'performance' | 'infrastructure' | 'architecture' | 'monitoring';
  priority: 'critical' | 'high' | 'medium' | 'low';
  action: string;
  estimatedImpact: string;
  implementationEffort: 'low' | 'medium' | 'high';
}

export interface InfrastructureRecommendation {
  component: string;
  currentCapacity: string;
  recommendedCapacity: string;
  scalingStrategy: 'vertical' | 'horizontal' | 'hybrid';
  estimatedCost: string;
}

/**
 * Scalability Assessment Engine
 */
export class ScalabilityAssessment {
  private results: LoadTestMetrics[] = [];
  private databaseResults: DatabaseLoadMetrics[] = [];
  private config: ScalabilityTestConfig;

  constructor(config: ScalabilityTestConfig) {
    this.config = config;
  }

  /**
   * Execute comprehensive scalability assessment
   */
  async execute(): Promise<ScalabilityTestResults> {
    console.log('🔬 Starting scalability assessment...');
    console.log(`👥 User range: ${this.config.startUsers} to ${this.config.maxUsers}`);
    console.log(`📈 Step size: ${this.config.stepSize} users`);
    console.log(`⏱️ Step duration: ${this.config.stepDuration}s`);

    try {
      // Run incremental load tests
      await this.runIncrementalLoadTests();

      // Run database scalability tests if enabled
      if (this.config.enableDatabaseTesting) {
        await this.runDatabaseScalabilityTests();
      }

      // Analyze results
      const scalabilityMetrics = this.analyzeScalabilityMetrics();
      const bottlenecks = this.identifyBottlenecks();
      const recommendations = this.generateRecommendations(scalabilityMetrics, bottlenecks);

      const results: ScalabilityTestResults = {
        testConfig: this.config,
        loadTestResults: this.results,
        databaseTestResults: this.databaseResults,
        scalabilityMetrics,
        bottlenecks,
        recommendations,
      };

      console.log('✅ Scalability assessment completed');
      return results;
    } catch (error) {
      console.error('❌ Scalability assessment failed:', error);
      throw error;
    }
  }

  /**
   * Run incremental load tests to identify scaling behavior
   */
  private async runIncrementalLoadTests(): Promise<void> {
    console.log('📊 Running incremental load tests...');

    for (let users = this.config.startUsers; users <= this.config.maxUsers; users += this.config.stepSize) {
      console.log(`🧪 Testing with ${users} concurrent users...`);

      const config: LoadTestConfig = {
        baseUrl: this.config.baseUrl,
        duration: this.config.stepDuration,
        concurrentUsers: users,
        rampUpTime: Math.min(users / 2, 30), // Scale ramp-up time
        scenario: LoadTestScenario.MIXED_WORKLOAD,
        enableMetrics: true,
        enableHeapDump: this.config.enableMemoryProfiling,
      };

      try {
        const result = await runLoadTest(config);
        this.results.push(result);

        // Check for early termination conditions
        if (this.shouldStopTesting(result)) {
          console.log(`⚠️ Stopping tests at ${users} users due to system limitations`);
          break;
        }

        // Brief pause between test runs
        await new Promise(resolve => setTimeout(resolve, 10000));
      } catch (error) {
        console.error(`❌ Load test failed at ${users} users:`, error);
        
        // Add failed result with error metrics
        this.results.push({
          ...config,
          scenario: LoadTestScenario.MIXED_WORKLOAD,
          duration: this.config.stepDuration,
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: users * 10, // Estimate
          averageResponseTime: 0,
          p50ResponseTime: 0,
          p95ResponseTime: 0,
          p99ResponseTime: 0,
          minResponseTime: 0,
          maxResponseTime: 0,
          requestsPerSecond: 0,
          errorRate: 100,
          memoryUsage: {
            initial: 0,
            peak: 0,
            final: 0,
            leakDetected: true,
            gcCount: 0,
          },
          databaseMetrics: {
            connectionPoolSize: 0,
            activeConnections: 0,
            averageQueryTime: 0,
            slowQueries: 0,
            totalQueries: 0,
          },
          customMetrics: { failed: true },
        });
        break;
      }
    }
  }

  /**
   * Run database scalability tests
   */
  private async runDatabaseScalabilityTests(): Promise<void> {
    console.log('🗄️ Running database scalability tests...');

    const dataSizes = [1000, 5000, 10000, 25000];
    const connectionCounts = [5, 10, 20, 40];

    for (const dataSize of dataSizes) {
      for (const connections of connectionCounts) {
        console.log(`🗄️ Testing DB with ${dataSize} records, ${connections} connections...`);

        const config: DatabaseLoadConfig = {
          concurrentConnections: connections,
          operationDuration: 60,
          dataVolumeTarget: dataSize,
          scenario: DatabaseScenario.MIXED_OPERATIONS,
          enableCleanup: true,
        };

        try {
          const result = await runDatabaseLoadTest(config);
          this.databaseResults.push(result);

          // Brief pause between database tests
          await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (error) {
          console.error(`❌ Database test failed:`, error);
          break;
        }
      }
    }
  }

  /**
   * Check if testing should stop due to system limitations
   */
  private shouldStopTesting(result: LoadTestMetrics): boolean {
    return (
      result.errorRate > 20 || // More than 20% error rate
      result.averageResponseTime > 10000 || // Average response time over 10 seconds
      result.memoryUsage.leakDetected || // Memory leak detected
      result.requestsPerSecond < 1 // Very low throughput
    );
  }

  /**
   * Analyze scalability metrics from test results
   */
  private analyzeScalabilityMetrics(): ScalabilityMetrics {
    console.log('📈 Analyzing scalability metrics...');

    // Find degradation point (where error rate exceeds 5% or response time doubles)
    const degradationPoint = this.findDegradationPoint();
    const maxSupportedUsers = this.findMaxSupportedUsers();
    const linearScalingRange = this.findLinearScalingRange();

    // Calculate growth rates
    const memoryGrowthRate = this.calculateMemoryGrowthRate();
    const responseTimeGrowth = this.analyzeResponseTimeGrowth();
    const throughputScaling = this.analyzeThroughputScaling();
    const resourceUtilization = this.analyzeResourceUtilization();

    return {
      maxSupportedUsers,
      degradationPoint,
      linearScalingRange,
      memoryGrowthRate,
      cpuUtilizationTrend: 0, // Would calculate from system metrics
      responseTimeGrowth,
      throughputScaling,
      resourceUtilization,
    };
  }

  /**
   * Find the point where performance starts to degrade
   */
  private findDegradationPoint(): number {
    const baseline = this.results[0];
    if (!baseline) return 0;

    const baselineResponseTime = baseline.averageResponseTime;
    const baselineErrorRate = baseline.errorRate;

    for (const result of this.results) {
      if (
        result.errorRate > baselineErrorRate + 5 || // 5% increase in error rate
        result.averageResponseTime > baselineResponseTime * 2 // Response time doubled
      ) {
        return this.getUserCountForResult(result);
      }
    }

    return this.config.maxUsers;
  }

  /**
   * Find maximum supported users (error rate < 10%)
   */
  private findMaxSupportedUsers(): number {
    let maxUsers = 0;

    for (const result of this.results) {
      if (result.errorRate < 10) {
        maxUsers = this.getUserCountForResult(result);
      } else {
        break;
      }
    }

    return maxUsers;
  }

  /**
   * Find range of linear scaling behavior
   */
  private findLinearScalingRange(): number {
    // Simplified: find where throughput stops scaling linearly
    const throughputGrowth: number[] = [];
    
    for (let i = 1; i < this.results.length; i++) {
      const previous = this.results[i - 1];
      const current = this.results[i];
      const growth = current.requestsPerSecond / previous.requestsPerSecond;
      throughputGrowth.push(growth);
    }

    // Find where growth drops below 80% of expected linear growth
    for (let i = 0; i < throughputGrowth.length; i++) {
      if (throughputGrowth[i] < 0.8) {
        return this.getUserCountForResult(this.results[i]);
      }
    }

    return this.config.maxUsers;
  }

  /**
   * Calculate memory growth rate per additional user
   */
  private calculateMemoryGrowthRate(): number {
    if (this.results.length < 2) return 0;

    const firstResult = this.results[0];
    const lastResult = this.results[this.results.length - 1];

    const memoryIncrease = lastResult.memoryUsage.final - firstResult.memoryUsage.initial;
    const userIncrease = this.getUserCountForResult(lastResult) - this.getUserCountForResult(firstResult);

    return userIncrease > 0 ? memoryIncrease / userIncrease : 0;
  }

  /**
   * Analyze response time growth pattern
   */
  private analyzeResponseTimeGrowth(): ResponseTimeGrowth {
    const responseTimes = this.results.map(r => r.averageResponseTime);
    const userCounts = this.results.map(r => this.getUserCountForResult(r));

    // Simple linear regression to determine growth pattern
    const linearGrowth = this.calculateLinearRegression(userCounts, responseTimes);
    const growthFactor = linearGrowth.slope;

    // Check if growth is approximately linear (R² > 0.8)
    const isLinear = linearGrowth.rSquared > 0.8;
    
    // Check for exponential growth pattern
    const logResponseTimes = responseTimes.map(rt => Math.log(rt + 1));
    const exponentialGrowth = this.calculateLinearRegression(userCounts, logResponseTimes);
    const isExponential = exponentialGrowth.rSquared > 0.9 && !isLinear;

    return {
      linear: isLinear,
      exponential: isExponential,
      growthFactor,
    };
  }

  /**
   * Analyze throughput scaling characteristics
   */
  private analyzeThroughputScaling(): ThroughputScaling {
    const maxThroughput = Math.max(...this.results.map(r => r.requestsPerSecond));
    const optimalResult = this.results.find(r => r.requestsPerSecond === maxThroughput);
    const optimalUserCount = optimalResult ? this.getUserCountForResult(optimalResult) : 0;

    // Calculate scaling efficiency
    const expectedLinearThroughput = this.results[0].requestsPerSecond * (optimalUserCount / this.getUserCountForResult(this.results[0]));
    const scalingEfficiency = (maxThroughput / expectedLinearThroughput) * 100;

    return {
      maxThroughput,
      optimalUserCount,
      scalingEfficiency: Math.min(scalingEfficiency, 100),
    };
  }

  /**
   * Analyze resource utilization patterns
   */
  private analyzeResourceUtilization(): ResourceUtilization {
    const lastResult = this.results[this.results.length - 1];
    
    return {
      memory: {
        current: lastResult.memoryUsage.peak,
        maximum: 1024, // 1GB limit (example)
        utilizationPercentage: (lastResult.memoryUsage.peak / 1024) * 100,
        bottleneckRisk: this.assessBottleneckRisk((lastResult.memoryUsage.peak / 1024) * 100),
      },
      cpu: {
        current: 50, // Would get from actual monitoring
        maximum: 100,
        utilizationPercentage: 50,
        bottleneckRisk: this.assessBottleneckRisk(50),
      },
      database: {
        current: lastResult.databaseMetrics.activeConnections,
        maximum: 100, // Example pool size
        utilizationPercentage: (lastResult.databaseMetrics.activeConnections / 100) * 100,
        bottleneckRisk: this.assessBottleneckRisk((lastResult.databaseMetrics.activeConnections / 100) * 100),
      },
      network: {
        current: 70, // Would get from actual monitoring
        maximum: 100,
        utilizationPercentage: 70,
        bottleneckRisk: this.assessBottleneckRisk(70),
      },
    };
  }

  /**
   * Assess bottleneck risk based on utilization percentage
   */
  private assessBottleneckRisk(utilizationPercentage: number): 'low' | 'medium' | 'high' | 'critical' {
    if (utilizationPercentage >= 90) return 'critical';
    if (utilizationPercentage >= 80) return 'high';
    if (utilizationPercentage >= 70) return 'medium';
    return 'low';
  }

  /**
   * Identify primary and secondary bottlenecks
   */
  private identifyBottlenecks(): BottleneckAnalysis {
    console.log('🔍 Identifying bottlenecks...');

    const bottlenecks: BottleneckType[] = [];
    let severityScore = 1;

    // Check for different types of bottlenecks
    const lastResult = this.results[this.results.length - 1];
    
    if (lastResult.errorRate > 10) {
      bottlenecks.push(BottleneckType.CPU);
      severityScore += 2;
    }

    if (lastResult.averageResponseTime > 5000) {
      bottlenecks.push(BottleneckType.DATABASE_QUERIES);
      severityScore += 3;
    }

    if (lastResult.memoryUsage.leakDetected) {
      bottlenecks.push(BottleneckType.MEMORY);
      severityScore += 4;
    }

    if (lastResult.databaseMetrics.slowQueries > lastResult.databaseMetrics.totalQueries * 0.1) {
      bottlenecks.push(BottleneckType.DATABASE_QUERIES);
      severityScore += 2;
    }

    const primaryBottleneck = bottlenecks[0] || BottleneckType.CPU;
    const secondaryBottlenecks = bottlenecks.slice(1);

    const impactAssessment = this.assessBottleneckImpact(severityScore);
    const mitigationStrategies = this.generateMitigationStrategies(bottlenecks);

    return {
      primaryBottleneck,
      secondaryBottlenecks,
      severityScore: Math.min(severityScore, 10),
      impactAssessment,
      mitigationStrategies,
    };
  }

  /**
   * Assess impact of identified bottlenecks
   */
  private assessBottleneckImpact(severityScore: number): BottleneckImpact {
    if (severityScore >= 8) {
      return {
        userExperience: 'severe',
        systemStability: 'critical',
        businessImpact: 'critical',
      };
    } else if (severityScore >= 6) {
      return {
        userExperience: 'significant',
        systemStability: 'unstable',
        businessImpact: 'high',
      };
    } else if (severityScore >= 4) {
      return {
        userExperience: 'moderate',
        systemStability: 'degraded',
        businessImpact: 'medium',
      };
    } else {
      return {
        userExperience: 'minimal',
        systemStability: 'stable',
        businessImpact: 'low',
      };
    }
  }

  /**
   * Generate mitigation strategies for identified bottlenecks
   */
  private generateMitigationStrategies(bottlenecks: BottleneckType[]): string[] {
    const strategies: string[] = [];

    bottlenecks.forEach(bottleneck => {
      switch (bottleneck) {
        case BottleneckType.CPU:
          strategies.push('Optimize CPU-intensive operations');
          strategies.push('Implement horizontal scaling');
          strategies.push('Add caching for compute-heavy operations');
          break;
        case BottleneckType.MEMORY:
          strategies.push('Implement memory leak detection and fixes');
          strategies.push('Optimize memory usage patterns');
          strategies.push('Increase available memory');
          break;
        case BottleneckType.DATABASE_CONNECTIONS:
          strategies.push('Increase database connection pool size');
          strategies.push('Implement connection pooling optimization');
          strategies.push('Add read replicas for load distribution');
          break;
        case BottleneckType.DATABASE_QUERIES:
          strategies.push('Optimize slow database queries');
          strategies.push('Add database indexes for common queries');
          strategies.push('Implement query result caching');
          break;
        case BottleneckType.AI_API_LIMITS:
          strategies.push('Implement AI API rate limiting and queuing');
          strategies.push('Add response caching for similar queries');
          strategies.push('Consider multiple AI provider fallbacks');
          break;
        default:
          strategies.push(`Optimize ${bottleneck} performance`);
      }
    });

    return [...new Set(strategies)]; // Remove duplicates
  }

  /**
   * Generate comprehensive scalability recommendations
   */
  private generateRecommendations(
    metrics: ScalabilityMetrics,
    bottlenecks: BottleneckAnalysis
  ): ScalabilityRecommendations {
    console.log('💡 Generating scalability recommendations...');

    const immediateActions: RecommendationAction[] = [];
    const shortTermOptimizations: RecommendationAction[] = [];
    const longTermStrategies: RecommendationAction[] = [];
    const infrastructureNeeds: InfrastructureRecommendation[] = [];

    // Generate recommendations based on bottlenecks
    if (bottlenecks.severityScore >= 7) {
      immediateActions.push({
        category: 'performance',
        priority: 'critical',
        action: `Address ${bottlenecks.primaryBottleneck} bottleneck immediately`,
        estimatedImpact: 'High - critical for system stability',
        implementationEffort: 'high',
      });
    }

    // Database recommendations
    if (bottlenecks.primaryBottleneck === BottleneckType.DATABASE_QUERIES) {
      shortTermOptimizations.push({
        category: 'performance',
        priority: 'high',
        action: 'Optimize database queries and add missing indexes',
        estimatedImpact: '30-50% improvement in response times',
        implementationEffort: 'medium',
      });

      infrastructureNeeds.push({
        component: 'Database',
        currentCapacity: 'Single instance',
        recommendedCapacity: 'Primary + Read replicas',
        scalingStrategy: 'horizontal',
        estimatedCost: 'Medium',
      });
    }

    // Memory recommendations
    if (metrics.memoryGrowthRate > 10) {
      shortTermOptimizations.push({
        category: 'performance',
        priority: 'high',
        action: 'Implement memory optimization and garbage collection tuning',
        estimatedImpact: 'Improved memory efficiency and stability',
        implementationEffort: 'medium',
      });
    }

    // Scalability recommendations
    if (metrics.maxSupportedUsers < 100) {
      longTermStrategies.push({
        category: 'architecture',
        priority: 'high',
        action: 'Implement horizontal scaling and load balancing',
        estimatedImpact: 'Support for 500+ concurrent users',
        implementationEffort: 'high',
      });
    }

    // Monitoring recommendations
    immediateActions.push({
      category: 'monitoring',
      priority: 'high',
      action: 'Implement comprehensive performance monitoring',
      estimatedImpact: 'Early detection of performance issues',
      implementationEffort: 'low',
    });

    return {
      immediateActions,
      shortTermOptimizations,
      longTermStrategies,
      infrastructureNeeds,
    };
  }

  /**
   * Helper methods
   */
  private getUserCountForResult(result: LoadTestMetrics): number {
    // Extract user count from the result (would be stored in custom metrics)
    return result.customMetrics?.userCount || 0;
  }

  private calculateLinearRegression(x: number[], y: number[]): { slope: number; intercept: number; rSquared: number } {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R²
    const meanY = sumY / n;
    const ssRes = y.reduce((sum, yi, i) => sum + Math.pow(yi - (slope * x[i] + intercept), 2), 0);
    const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0);
    const rSquared = 1 - (ssRes / ssTot);

    return { slope, intercept, rSquared };
  }
}

/**
 * Convenience function to run scalability assessment
 */
export async function runScalabilityAssessment(config: ScalabilityTestConfig): Promise<ScalabilityTestResults> {
  const assessment = new ScalabilityAssessment(config);
  return await assessment.execute();
}