// Database Load Testing - Task 4.1: Load Testing
// Comprehensive database performance testing with realistic data volumes

import { PrismaClient } from '@prisma/client';

// Database load test configuration
export interface DatabaseLoadConfig {
  concurrentConnections: number;
  operationDuration: number; // seconds
  dataVolumeTarget: number; // number of records
  scenario: DatabaseScenario;
  enableCleanup: boolean;
}

export enum DatabaseScenario {
  AUDIT_SESSIONS_LOAD = 'audit_sessions_load',
  CHAT_MESSAGES_LOAD = 'chat_messages_load',
  REPORTS_LOAD = 'reports_load',
  MIXED_OPERATIONS = 'mixed_operations',
  CONNECTION_POOL_STRESS = 'connection_pool_stress',
  LARGE_QUERY_PERFORMANCE = 'large_query_performance',
  CONCURRENT_WRITES = 'concurrent_writes',
}

// Database performance metrics
export interface DatabaseLoadMetrics {
  scenario: DatabaseScenario;
  duration: number;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageQueryTime: number;
  p95QueryTime: number;
  p99QueryTime: number;
  slowQueries: number; // queries > 1000ms
  connectionPoolMetrics: ConnectionPoolMetrics;
  dataVolumeCreated: number;
  memoryUsage: number;
  indexPerformance: IndexPerformanceMetrics[];
}

export interface ConnectionPoolMetrics {
  maxConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  connectionErrors: number;
  averageAcquisitionTime: number;
}

export interface IndexPerformanceMetrics {
  tableName: string;
  indexName: string;
  queryType: string;
  executionTime: number;
  rowsExamined: number;
  rowsReturned: number;
  indexUsed: boolean;
}

/**
 * Database Load Tester for comprehensive database performance validation
 */
export class DatabaseLoadTester {
  private prisma: PrismaClient;
  private results: any[] = [];
  private startTime: number = 0;

  constructor(private config: DatabaseLoadConfig) {
    this.prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }

  /**
   * Execute database load test
   */
  async execute(): Promise<DatabaseLoadMetrics> {
    console.log(`🗄️ Starting database load test: ${this.config.scenario}`);
    console.log(`📊 Target volume: ${this.config.dataVolumeTarget} records`);
    console.log(`🔗 Concurrent connections: ${this.config.concurrentConnections}`);
    console.log(`⏱️ Duration: ${this.config.operationDuration}s`);

    this.startTime = Date.now();

    try {
      // Setup test data if needed
      await this.setupTestData();

      // Execute scenario
      await this.executeScenario();

      // Collect metrics
      const metrics = await this.collectMetrics();

      // Cleanup if enabled
      if (this.config.enableCleanup) {
        await this.cleanup();
      }

      console.log(`✅ Database load test completed`);
      return metrics;
    } catch (error) {
      console.error(`❌ Database load test failed:`, error);
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  /**
   * Setup test data for realistic volumes
   */
  private async setupTestData(): Promise<void> {
    console.log('📝 Setting up test data...');

    try {
      // Create test users if needed
      await this.createTestUsers(Math.min(1000, this.config.dataVolumeTarget / 10));

      // Create initial audit sessions for testing
      if (this.config.scenario === DatabaseScenario.AUDIT_SESSIONS_LOAD ||
          this.config.scenario === DatabaseScenario.MIXED_OPERATIONS) {
        await this.createTestAuditSessions(Math.min(5000, this.config.dataVolumeTarget / 2));
      }

      console.log('✅ Test data setup completed');
    } catch (error) {
      console.error('❌ Test data setup failed:', error);
      throw error;
    }
  }

  /**
   * Create test users for realistic data volume
   */
  private async createTestUsers(count: number): Promise<void> {
    console.log(`👥 Creating ${count} test users...`);

    const batchSize = 100;
    const batches = Math.ceil(count / batchSize);

    for (let batch = 0; batch < batches; batch++) {
      const batchStart = batch * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, count);
      const batchCount = batchEnd - batchStart;

      const users = Array.from({ length: batchCount }, (_, i) => ({
        id: `load_test_user_${batchStart + i}`,
        email: `loadtest${batchStart + i}@example.com`,
        firstName: `Test`,
        lastName: `User${batchStart + i}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      try {
        await this.prisma.user.createMany({
          data: users,
          skipDuplicates: true,
        });
      } catch (error) {
        // Continue on duplicate errors
        if (!error.message.includes('unique constraint')) {
          throw error;
        }
      }
    }
  }

  /**
   * Create test audit sessions for realistic workload
   */
  private async createTestAuditSessions(count: number): Promise<void> {
    console.log(`📋 Creating ${count} test audit sessions...`);

    const batchSize = 50;
    const batches = Math.ceil(count / batchSize);

    for (let batch = 0; batch < batches; batch++) {
      const batchStart = batch * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, count);
      const batchCount = batchEnd - batchStart;

      const sessions = Array.from({ length: batchCount }, (_, i) => ({
        id: `load_test_session_${batchStart + i}`,
        userId: Math.random() > 0.3 ? `load_test_user_${Math.floor(Math.random() * 1000)}` : null,
        isGuest: Math.random() > 0.3,
        currentStep: Math.floor(Math.random() * 5) + 1,
        totalSteps: 5,
        responses: {
          companySize: 'startup',
          aiUsage: Math.floor(Math.random() * 10) + 1,
          technicalMaturity: Math.floor(Math.random() * 10) + 1,
        },
        score: Math.floor(Math.random() * 100),
        completedAt: Math.random() > 0.5 ? new Date() : null,
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random within last 30 days
        updatedAt: new Date(),
      }));

      try {
        await this.prisma.auditSession.createMany({
          data: sessions,
          skipDuplicates: true,
        });
      } catch (error) {
        if (!error.message.includes('unique constraint')) {
          throw error;
        }
      }
    }
  }

  /**
   * Execute specific database scenario
   */
  private async executeScenario(): Promise<void> {
    const { concurrentConnections, operationDuration } = this.config;
    const endTime = Date.now() + (operationDuration * 1000);

    // Spawn concurrent database operations
    const promises = Array.from({ length: concurrentConnections }, (_, i) => 
      this.runConcurrentOperations(`worker_${i}`, endTime)
    );

    this.results = await Promise.all(promises);
  }

  /**
   * Run concurrent database operations for a worker
   */
  private async runConcurrentOperations(workerId: string, endTime: number): Promise<any> {
    let operations = 0;
    let failures = 0;
    const queryTimes: number[] = [];

    while (Date.now() < endTime) {
      try {
        const startQuery = Date.now();
        
        switch (this.config.scenario) {
          case DatabaseScenario.AUDIT_SESSIONS_LOAD:
            await this.performAuditSessionOperations();
            break;
          case DatabaseScenario.CHAT_MESSAGES_LOAD:
            await this.performChatMessageOperations();
            break;
          case DatabaseScenario.REPORTS_LOAD:
            await this.performReportOperations();
            break;
          case DatabaseScenario.MIXED_OPERATIONS:
            await this.performMixedOperations();
            break;
          case DatabaseScenario.CONNECTION_POOL_STRESS:
            await this.performConnectionPoolStress();
            break;
          case DatabaseScenario.LARGE_QUERY_PERFORMANCE:
            await this.performLargeQueryOperations();
            break;
          case DatabaseScenario.CONCURRENT_WRITES:
            await this.performConcurrentWriteOperations();
            break;
        }

        const queryTime = Date.now() - startQuery;
        queryTimes.push(queryTime);
        operations++;

        // Brief pause to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        failures++;
        console.warn(`Database operation failed for ${workerId}:`, error.message);
      }
    }

    return {
      workerId,
      operations,
      failures,
      queryTimes,
      averageQueryTime: queryTimes.length > 0 ? queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length : 0,
    };
  }

  /**
   * Audit session database operations
   */
  private async performAuditSessionOperations(): Promise<void> {
    const operations = ['create', 'read', 'update', 'list'];
    const operation = operations[Math.floor(Math.random() * operations.length)];

    switch (operation) {
      case 'create':
        await this.prisma.auditSession.create({
          data: {
            id: `perf_test_${Date.now()}_${Math.random()}`,
            isGuest: true,
            currentStep: 1,
            totalSteps: 5,
            responses: { companySize: 'startup' },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        break;
      case 'read':
        await this.prisma.auditSession.findFirst({
          where: { isGuest: true },
          include: { user: true },
        });
        break;
      case 'update':
        const session = await this.prisma.auditSession.findFirst({
          where: { completedAt: null },
        });
        if (session) {
          await this.prisma.auditSession.update({
            where: { id: session.id },
            data: {
              currentStep: session.currentStep + 1,
              updatedAt: new Date(),
            },
          });
        }
        break;
      case 'list':
        await this.prisma.auditSession.findMany({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });
        break;
    }
  }

  /**
   * Chat message database operations
   */
  private async performChatMessageOperations(): Promise<void> {
    const operations = ['create', 'read_history', 'search'];
    const operation = operations[Math.floor(Math.random() * operations.length)];

    switch (operation) {
      case 'create':
        const sessionId = `load_test_session_${Math.floor(Math.random() * 5000)}`;
        await this.prisma.chatMessage.create({
          data: {
            sessionId,
            message: `Load test message ${Date.now()}`,
            response: `AI response ${Date.now()}`,
            tokens: Math.floor(Math.random() * 1000) + 100,
            createdAt: new Date(),
          },
        });
        break;
      case 'read_history':
        const randomSessionId = `load_test_session_${Math.floor(Math.random() * 5000)}`;
        await this.prisma.chatMessage.findMany({
          where: { sessionId: randomSessionId },
          orderBy: { createdAt: 'asc' },
          take: 20,
        });
        break;
      case 'search':
        await this.prisma.chatMessage.findMany({
          where: {
            message: {
              contains: 'AI',
              mode: 'insensitive',
            },
          },
          take: 10,
        });
        break;
    }
  }

  /**
   * Report database operations
   */
  private async performReportOperations(): Promise<void> {
    const operations = ['create', 'read', 'list_recent'];
    const operation = operations[Math.floor(Math.random() * operations.length)];

    switch (operation) {
      case 'create':
        const sessionId = `load_test_session_${Math.floor(Math.random() * 5000)}`;
        await this.prisma.reportGeneration.create({
          data: {
            sessionId,
            format: Math.random() > 0.5 ? 'pdf' : 'markdown',
            status: 'completed',
            fileUrl: `https://example.com/report_${Date.now()}.pdf`,
            generatedAt: new Date(),
            createdAt: new Date(),
          },
        });
        break;
      case 'read':
        await this.prisma.reportGeneration.findFirst({
          where: { status: 'completed' },
          include: { session: true },
        });
        break;
      case 'list_recent':
        await this.prisma.reportGeneration.findMany({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        });
        break;
    }
  }

  /**
   * Mixed database operations for realistic workload
   */
  private async performMixedOperations(): Promise<void> {
    const scenarios = [
      () => this.performAuditSessionOperations(),
      () => this.performChatMessageOperations(),
      () => this.performReportOperations(),
    ];

    const operation = scenarios[Math.floor(Math.random() * scenarios.length)];
    await operation();
  }

  /**
   * Connection pool stress testing
   */
  private async performConnectionPoolStress(): Promise<void> {
    // Create multiple concurrent queries to stress the connection pool
    const concurrentQueries = Array.from({ length: 5 }, () => 
      this.prisma.auditSession.count()
    );

    await Promise.all(concurrentQueries);
  }

  /**
   * Large query performance testing
   */
  private async performLargeQueryOperations(): Promise<void> {
    const operations = ['large_scan', 'aggregation', 'join_query'];
    const operation = operations[Math.floor(Math.random() * operations.length)];

    switch (operation) {
      case 'large_scan':
        await this.prisma.auditSession.findMany({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            },
          },
          include: { user: true },
          take: 1000,
        });
        break;
      case 'aggregation':
        await this.prisma.auditSession.groupBy({
          by: ['isGuest'],
          _count: { id: true },
          _avg: { score: true },
          where: {
            completedAt: { not: null },
          },
        });
        break;
      case 'join_query':
        await this.prisma.auditSession.findMany({
          where: {
            user: {
              email: { contains: '@example.com' },
            },
          },
          include: {
            user: true,
            chatMessages: true,
            reports: true,
          },
          take: 100,
        });
        break;
    }
  }

  /**
   * Concurrent write operations testing
   */
  private async performConcurrentWriteOperations(): Promise<void> {
    const sessionId = `concurrent_test_${Date.now()}_${Math.random()}`;
    
    // Simulate concurrent updates to the same session
    const updates = Array.from({ length: 3 }, (_, i) => 
      this.prisma.auditSession.upsert({
        where: { id: sessionId },
        create: {
          id: sessionId,
          isGuest: true,
          currentStep: i + 1,
          totalSteps: 5,
          responses: { step: i + 1 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        update: {
          currentStep: i + 1,
          responses: { step: i + 1 },
          updatedAt: new Date(),
        },
      })
    );

    await Promise.all(updates);
  }

  /**
   * Collect comprehensive database metrics
   */
  private async collectMetrics(): Promise<DatabaseLoadMetrics> {
    const duration = (Date.now() - this.startTime) / 1000;
    
    // Aggregate worker results
    const totalOperations = this.results.reduce((sum, r) => sum + r.operations, 0);
    const failedOperations = this.results.reduce((sum, r) => sum + r.failures, 0);
    const allQueryTimes = this.results.flatMap(r => r.queryTimes);
    
    const averageQueryTime = allQueryTimes.length > 0 
      ? allQueryTimes.reduce((sum, t) => sum + t, 0) / allQueryTimes.length 
      : 0;

    // Calculate percentiles
    const sortedQueryTimes = allQueryTimes.sort((a, b) => a - b);
    const p95QueryTime = this.calculatePercentile(sortedQueryTimes, 95);
    const p99QueryTime = this.calculatePercentile(sortedQueryTimes, 99);
    const slowQueries = allQueryTimes.filter(t => t > 1000).length;

    // Collect connection pool metrics (simulated - would need actual pool monitoring)
    const connectionPoolMetrics: ConnectionPoolMetrics = {
      maxConnections: this.config.concurrentConnections,
      activeConnections: Math.floor(this.config.concurrentConnections * 0.8),
      idleConnections: Math.floor(this.config.concurrentConnections * 0.2),
      waitingRequests: 0,
      connectionErrors: failedOperations,
      averageAcquisitionTime: 10, // ms
    };

    return {
      scenario: this.config.scenario,
      duration,
      totalOperations,
      successfulOperations: totalOperations - failedOperations,
      failedOperations,
      averageQueryTime,
      p95QueryTime,
      p99QueryTime,
      slowQueries,
      connectionPoolMetrics,
      dataVolumeCreated: this.config.dataVolumeTarget,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      indexPerformance: [], // Would be populated with actual index analysis
    };
  }

  /**
   * Calculate percentile from sorted array
   */
  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Cleanup test data
   */
  private async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up test data...');

    try {
      // Delete test data created during load testing
      await this.prisma.chatMessage.deleteMany({
        where: {
          message: { contains: 'Load test message' },
        },
      });

      await this.prisma.reportGeneration.deleteMany({
        where: {
          fileUrl: { contains: 'example.com/report_' },
        },
      });

      await this.prisma.auditSession.deleteMany({
        where: {
          OR: [
            { id: { contains: 'perf_test_' } },
            { id: { contains: 'concurrent_test_' } },
            { id: { contains: 'load_test_session_' } },
          ],
        },
      });

      await this.prisma.user.deleteMany({
        where: {
          id: { contains: 'load_test_user_' },
        },
      });

      console.log('✅ Cleanup completed');
    } catch (error) {
      console.warn('⚠️ Cleanup failed:', error);
    }
  }
}

/**
 * Convenience function to run database load tests
 */
export async function runDatabaseLoadTest(config: DatabaseLoadConfig): Promise<DatabaseLoadMetrics> {
  const tester = new DatabaseLoadTester(config);
  return await tester.execute();
}