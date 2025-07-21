// Optimized Database Operations - Task 3.1: Performance Optimization
// Provides optimized queries with caching, pagination, and performance monitoring

import { PrismaClient } from '@prisma/client';
import { cache, CACHE_KEYS, CACHE_TTL } from './cache';

// Performance monitoring
interface QueryMetrics {
  query: string;
  duration: number;
  cached: boolean;
  timestamp: number;
}

class DatabaseOptimizer {
  private queryMetrics: QueryMetrics[] = [];
  private readonly MAX_METRICS = 1000;

  constructor(private prisma: PrismaClient) {}

  /**
   * Track query performance
   */
  private trackQuery(query: string, duration: number, cached: boolean = false): void {
    this.queryMetrics.push({
      query,
      duration,
      cached,
      timestamp: Date.now(),
    });

    // Keep only recent metrics
    if (this.queryMetrics.length > this.MAX_METRICS) {
      this.queryMetrics = this.queryMetrics.slice(-this.MAX_METRICS);
    }

    // Log slow queries
    if (duration > 1000 && !cached) {
      console.warn(`🐌 Slow query detected: ${query} (${duration}ms)`);
    }
  }

  /**
   * Execute query with caching and performance tracking
   */
  private async executeWithCache<T>(
    cacheKey: string,
    queryFn: () => Promise<T>,
    ttl: number = CACHE_TTL.QUERY_RESULTS,
    queryName: string = 'unknown'
  ): Promise<T> {
    const start = Date.now();

    // Try cache first
    const cached = await cache.get<T>(cacheKey);
    if (cached !== null) {
      const duration = Date.now() - start;
      this.trackQuery(queryName, duration, true);
      return cached;
    }

    // Execute query
    const result = await queryFn();
    const duration = Date.now() - start;
    this.trackQuery(queryName, duration, false);

    // Cache result
    await cache.set(cacheKey, result, ttl);

    return result;
  }

  /**
   * Get audit session with optimized includes and caching
   */
  async getAuditSession(sessionId: string, includeRelations: boolean = true) {
    const cacheKey = CACHE_KEYS.session(sessionId);
    
    return this.executeWithCache(
      cacheKey,
      async () => {
        if (!includeRelations) {
          return this.prisma.auditSession.findUnique({
            where: { id: sessionId },
          });
        }

        return this.prisma.auditSession.findUnique({
          where: { id: sessionId },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            answers: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                questionKey: true,
                stepId: true,
                value: true,
                createdAt: true,
              },
            },
            _count: {
              select: {
                chatMessages: true,
              },
            },
          },
        });
      },
      CACHE_TTL.SESSION,
      `getAuditSession:${sessionId}`
    );
  }

  /**
   * Get session answers with caching
   */
  async getSessionAnswers(sessionId: string) {
    const cacheKey = CACHE_KEYS.sessionAnswers(sessionId);
    
    return this.executeWithCache(
      cacheKey,
      async () => {
        return this.prisma.auditAnswer.findMany({
          where: { auditSessionId: sessionId },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            questionKey: true,
            stepId: true,
            value: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      },
      CACHE_TTL.SESSION_ANSWERS,
      `getSessionAnswers:${sessionId}`
    );
  }

  /**
   * Get user sessions with pagination and caching
   */
  async getUserSessions(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: string[];
      includeDrafts?: boolean;
    } = {}
  ) {
    const { limit = 10, offset = 0, status, includeDrafts = true } = options;
    const cacheKey = `${CACHE_KEYS.userSessions(userId)}:${JSON.stringify(options)}`;
    
    return this.executeWithCache(
      cacheKey,
      async () => {
        const where: any = { userId };
        
        if (status && status.length > 0) {
          where.status = { in: status };
        } else if (!includeDrafts) {
          where.status = { not: 'DRAFT' };
        }

        const [sessions, total] = await Promise.all([
          this.prisma.auditSession.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            take: limit,
            skip: offset,
            select: {
              id: true,
              status: true,
              score: true,
              startedAt: true,
              completedAt: true,
              updatedAt: true,
              _count: {
                select: {
                  answers: true,
                  chatMessages: true,
                },
              },
            },
          }),
          this.prisma.auditSession.count({ where }),
        ]);

        return {
          sessions,
          total,
          hasMore: offset + limit < total,
        };
      },
      CACHE_TTL.USER_SESSIONS,
      `getUserSessions:${userId}`
    );
  }

  /**
   * Get guest session by anonymous ID with caching
   */
  async getGuestSession(anonymousId: string) {
    const cacheKey = CACHE_KEYS.guestSession(anonymousId);
    
    return this.executeWithCache(
      cacheKey,
      async () => {
        return this.prisma.auditSession.findUnique({
          where: { anonymousId },
          include: {
            answers: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                questionKey: true,
                stepId: true,
                value: true,
                createdAt: true,
              },
            },
            _count: {
              select: {
                chatMessages: true,
              },
            },
          },
        });
      },
      CACHE_TTL.SESSION,
      `getGuestSession:${anonymousId}`
    );
  }

  /**
   * Get chat messages with pagination and caching
   */
  async getChatMessages(
    sessionId: string,
    options: {
      limit?: number;
      offset?: number;
      includeEmbeddings?: boolean;
    } = {}
  ) {
    const { limit = 50, offset = 0, includeEmbeddings = false } = options;
    const cacheKey = `${CACHE_KEYS.chatMessages(sessionId)}:${JSON.stringify(options)}`;
    
    return this.executeWithCache(
      cacheKey,
      async () => {
        const select: any = {
          id: true,
          role: true,
          content: true,
          metadata: true,
          tokens: true,
          createdAt: true,
        };

        if (includeEmbeddings) {
          select.embedding = true;
        }

        const [messages, total] = await Promise.all([
          this.prisma.chatMessage.findMany({
            where: { auditSessionId: sessionId },
            orderBy: { createdAt: 'asc' },
            take: limit,
            skip: offset,
            select,
          }),
          this.prisma.chatMessage.count({
            where: { auditSessionId: sessionId },
          }),
        ]);

        return {
          messages,
          total,
          hasMore: offset + limit < total,
        };
      },
      CACHE_TTL.CHAT_CONTEXT,
      `getChatMessages:${sessionId}`
    );
  }

  /**
   * Get analytics data with heavy caching
   */
  async getSessionAnalytics(period: 'day' | 'week' | 'month' = 'week') {
    const cacheKey = CACHE_KEYS.sessionAnalytics(period);
    
    return this.executeWithCache(
      cacheKey,
      async () => {
        const now = new Date();
        let startDate: Date;

        switch (period) {
          case 'day':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        }

        const [
          totalSessions,
          completedSessions,
          guestSessions,
          userSessions,
          averageScore,
        ] = await Promise.all([
          this.prisma.auditSession.count({
            where: { startedAt: { gte: startDate } },
          }),
          this.prisma.auditSession.count({
            where: {
              startedAt: { gte: startDate },
              status: { in: ['SUBMITTED', 'SCORED', 'REPORT_READY'] },
            },
          }),
          this.prisma.auditSession.count({
            where: {
              startedAt: { gte: startDate },
              anonymousId: { not: null },
            },
          }),
          this.prisma.auditSession.count({
            where: {
              startedAt: { gte: startDate },
              userId: { not: null },
            },
          }),
          this.prisma.auditSession.aggregate({
            where: {
              startedAt: { gte: startDate },
              score: { not: null },
            },
            _avg: { score: true },
            _count: { score: true },
          }),
        ]);

        return {
          period,
          totalSessions,
          completedSessions,
          guestSessions,
          userSessions,
          completionRate: totalSessions > 0 ? completedSessions / totalSessions : 0,
          averageScore: averageScore._avg.score || 0,
          scoreCount: averageScore._count.score,
        };
      },
      CACHE_TTL.ANALYTICS,
      `getSessionAnalytics:${period}`
    );
  }

  /**
   * Optimized PDF job queries
   */
  async getPDFJobs(
    sessionId?: string,
    status?: string[],
    options: { limit?: number; offset?: number } = {}
  ) {
    const { limit = 20, offset = 0 } = options;
    const cacheKey = `pdfjobs:${sessionId || 'all'}:${status?.join(',') || 'all'}:${limit}:${offset}`;
    
    return this.executeWithCache(
      cacheKey,
      async () => {
        const where: any = {};
        if (sessionId) where.sessionId = sessionId;
        if (status && status.length > 0) where.status = { in: status };

        const [jobs, total] = await Promise.all([
          this.prisma.pDFJob.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
            include: {
              auditSession: {
                select: {
                  id: true,
                  companyName: true,
                  user: {
                    select: {
                      firstName: true,
                      lastName: true,
                      email: true,
                    },
                  },
                },
              },
            },
          }),
          this.prisma.pDFJob.count({ where }),
        ]);

        return {
          jobs,
          total,
          hasMore: offset + limit < total,
        };
      },
      CACHE_TTL.QUERY_RESULTS,
      'getPDFJobs'
    );
  }

  /**
   * Optimized search with full-text search capabilities
   */
  async searchSessions(
    query: string,
    options: {
      userId?: string;
      status?: string[];
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const { userId, status, limit = 10, offset = 0 } = options;
    const cacheKey = `search:${query}:${JSON.stringify(options)}`;
    
    return this.executeWithCache(
      cacheKey,
      async () => {
        const where: any = {
          OR: [
            { companyName: { contains: query, mode: 'insensitive' } },
            { guestEmail: { contains: query, mode: 'insensitive' } },
          ],
        };

        if (userId) where.userId = userId;
        if (status && status.length > 0) where.status = { in: status };

        const [sessions, total] = await Promise.all([
          this.prisma.auditSession.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            take: limit,
            skip: offset,
            select: {
              id: true,
              status: true,
              companyName: true,
              guestEmail: true,
              startedAt: true,
              completedAt: true,
              score: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          }),
          this.prisma.auditSession.count({ where }),
        ]);

        return {
          sessions,
          total,
          hasMore: offset + limit < total,
          query,
        };
      },
      CACHE_TTL.QUERY_RESULTS,
      `searchSessions:${query}`
    );
  }

  /**
   * Bulk operations with transaction support
   */
  async updateSessionAnswers(
    sessionId: string,
    answers: Array<{
      questionKey: string;
      stepId: string;
      value: any;
    }>
  ) {
    const start = Date.now();

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const updates = answers.map(answer =>
          tx.auditAnswer.upsert({
            where: {
              auditSessionId_questionKey: {
                auditSessionId: sessionId,
                questionKey: answer.questionKey,
              },
            },
            update: {
              value: answer.value,
              stepId: answer.stepId,
              updatedAt: new Date(),
            },
            create: {
              auditSessionId: sessionId,
              questionKey: answer.questionKey,
              stepId: answer.stepId,
              value: answer.value,
            },
          })
        );

        return Promise.all(updates);
      });

      // Invalidate related caches
      await Promise.all([
        cache.invalidateSession(sessionId),
      ]);

      const duration = Date.now() - start;
      this.trackQuery(`updateSessionAnswers:${answers.length}`, duration);

      return result;

    } catch (error) {
      const duration = Date.now() - start;
      this.trackQuery(`updateSessionAnswers:error`, duration);
      throw error;
    }
  }

  /**
   * Database health and performance monitoring
   */
  async getDatabaseHealth() {
    const start = Date.now();

    try {
      // Test basic connectivity
      await this.prisma.$queryRaw`SELECT 1`;
      
      // Get database statistics
      const stats = await this.prisma.$queryRaw<Array<{
        schemaname: string;
        tablename: string;
        n_tup_ins: bigint;
        n_tup_upd: bigint;
        n_tup_del: bigint;
      }>>`
        SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        ORDER BY n_tup_ins + n_tup_upd + n_tup_del DESC
        LIMIT 10
      `;

      const queryTime = Date.now() - start;

      return {
        status: 'healthy',
        queryTime,
        recentQueries: this.getRecentQueries(),
        tableStats: stats,
        cacheMetrics: cache.getMetrics(),
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        queryTime: Date.now() - start,
        recentQueries: this.getRecentQueries(),
        cacheMetrics: cache.getMetrics(),
      };
    }
  }

  /**
   * Get recent query performance metrics
   */
  getRecentQueries(limit: number = 20) {
    return this.queryMetrics
      .slice(-limit)
      .map(metric => ({
        ...metric,
        timestamp: new Date(metric.timestamp).toISOString(),
      }));
  }

  /**
   * Get query performance summary
   */
  getQueryStats() {
    const recentQueries = this.queryMetrics.slice(-100); // Last 100 queries
    
    if (recentQueries.length === 0) {
      return {
        totalQueries: 0,
        averageDuration: 0,
        cachedQueries: 0,
        cacheHitRate: 0,
        slowQueries: 0,
      };
    }

    const totalQueries = recentQueries.length;
    const cachedQueries = recentQueries.filter(q => q.cached).length;
    const slowQueries = recentQueries.filter(q => q.duration > 1000).length;
    const averageDuration = recentQueries.reduce((sum, q) => sum + q.duration, 0) / totalQueries;

    return {
      totalQueries,
      averageDuration: Math.round(averageDuration),
      cachedQueries,
      cacheHitRate: Math.round((cachedQueries / totalQueries) * 100),
      slowQueries,
    };
  }
}

// Create optimized database instance
const db = new PrismaClient();
export const dbOptimized = new DatabaseOptimizer(db);

// Cleanup on process exit
process.on('beforeExit', () => {
  db.$disconnect();
});