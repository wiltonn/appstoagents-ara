// Redis Caching Service - Task 3.1: Performance Optimization
// Provides intelligent caching with TTL management and cache invalidation

import Redis from 'ioredis';
import type { AuditSession, AuditAnswer, ChatMessage } from '@prisma/client';

export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  username?: string;
  db?: number;
  maxRetriesPerRequest?: number;
  retryDelayOnFailover?: number;
  enableOfflineQueue?: boolean;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  hitRatio: number;
}

/**
 * Cache TTL configurations (in seconds)
 */
export const CACHE_TTL = {
  // Session data - medium TTL since it changes during audit
  SESSION: 5 * 60,           // 5 minutes
  SESSION_ANSWERS: 3 * 60,   // 3 minutes
  
  // User data - longer TTL since it changes less frequently
  USER_PROFILE: 15 * 60,     // 15 minutes
  USER_SESSIONS: 10 * 60,    // 10 minutes
  
  // Static/Configuration data - very long TTL
  WIZARD_CONFIG: 60 * 60,    // 1 hour
  SCORING_CONFIG: 30 * 60,   // 30 minutes
  
  // Analytics and reports - medium TTL
  ANALYTICS: 10 * 60,        // 10 minutes
  REPORT_DATA: 15 * 60,      // 15 minutes
  
  // Chat and AI responses - short TTL due to context sensitivity
  CHAT_CONTEXT: 2 * 60,      // 2 minutes
  AI_RESPONSES: 5 * 60,      // 5 minutes
  
  // Database query results - very short TTL
  QUERY_RESULTS: 1 * 60,     // 1 minute
  
  // Temporary locks and flags
  LOCKS: 30,                 // 30 seconds
  RATE_LIMITS: 60,           // 1 minute
} as const;

/**
 * Cache key patterns for consistent naming
 */
export const CACHE_KEYS = {
  // Session keys
  session: (sessionId: string) => `session:${sessionId}`,
  sessionAnswers: (sessionId: string) => `session:${sessionId}:answers`,
  sessionProgress: (sessionId: string) => `session:${sessionId}:progress`,
  
  // User keys
  userProfile: (userId: string) => `user:${userId}:profile`,
  userSessions: (userId: string) => `user:${userId}:sessions`,
  userAnalytics: (userId: string) => `user:${userId}:analytics`,
  
  // Guest session keys
  guestSession: (anonymousId: string) => `guest:${anonymousId}`,
  guestProgress: (anonymousId: string) => `guest:${anonymousId}:progress`,
  
  // Configuration keys
  wizardConfig: () => `config:wizard`,
  scoringConfig: () => `config:scoring`,
  
  // Chat keys
  chatMessages: (sessionId: string) => `chat:${sessionId}:messages`,
  chatContext: (sessionId: string) => `chat:${sessionId}:context`,
  
  // Analytics keys
  sessionAnalytics: (period: string) => `analytics:sessions:${period}`,
  userAnalytics: (period: string) => `analytics:users:${period}`,
  
  // Query cache keys
  queryCache: (hash: string) => `query:${hash}`,
  
  // Lock keys
  lock: (resource: string) => `lock:${resource}`,
  rateLimit: (identifier: string) => `rate:${identifier}`,
} as const;

export class CacheService {
  private redis: Redis | null = null;
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    hitRatio: 0,
  };
  private isConnected = false;

  constructor(private config?: CacheConfig) {}

  /**
   * Initialize Redis connection
   */
  async initialize(): Promise<void> {
    try {
      const defaultConfig: CacheConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        username: process.env.REDIS_USERNAME,
        db: parseInt(process.env.REDIS_DB || '0'),
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        enableOfflineQueue: false,
      };

      const redisConfig = { ...defaultConfig, ...this.config };

      this.redis = new Redis(redisConfig);

      // Setup event listeners
      this.redis.on('connect', () => {
        console.log('✅ Redis cache connected successfully');
        this.isConnected = true;
      });

      this.redis.on('error', (error) => {
        console.error('❌ Redis cache error:', error);
        this.metrics.errors++;
        this.isConnected = false;
      });

      this.redis.on('close', () => {
        console.log('🔌 Redis cache connection closed');
        this.isConnected = false;
      });

      // Test connection
      await this.redis.ping();
      console.log('🚀 Cache service initialized successfully');

    } catch (error) {
      console.error('Failed to initialize cache service:', error);
      this.redis = null;
      // Don't throw error - degrade gracefully without cache
    }
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    if (!this.redis || !this.isConnected) {
      this.metrics.misses++;
      return null;
    }

    try {
      const value = await this.redis.get(key);
      
      if (value === null) {
        this.metrics.misses++;
        return null;
      }

      this.metrics.hits++;
      this.updateHitRatio();

      // Try to parse as JSON, fallback to string
      try {
        return JSON.parse(value);
      } catch {
        return value as T;
      }

    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      this.metrics.errors++;
      this.metrics.misses++;
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    if (!this.redis || !this.isConnected) {
      return false;
    }

    try {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (ttl) {
        await this.redis.setex(key, ttl, serializedValue);
      } else {
        await this.redis.set(key, serializedValue);
      }

      this.metrics.sets++;
      return true;

    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.redis || !this.isConnected) {
      return false;
    }

    try {
      const result = await this.redis.del(key);
      this.metrics.deletes++;
      return result > 0;

    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Delete multiple keys matching pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!this.redis || !this.isConnected) {
      return 0;
    }

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) return 0;

      const deleted = await this.redis.del(...keys);
      this.metrics.deletes += deleted;
      return deleted;

    } catch (error) {
      console.error(`Cache delete pattern error for ${pattern}:`, error);
      this.metrics.errors++;
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.redis || !this.isConnected) {
      return false;
    }

    try {
      const exists = await this.redis.exists(key);
      return exists === 1;

    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Increment a counter
   */
  async increment(key: string, ttl?: number): Promise<number> {
    if (!this.redis || !this.isConnected) {
      return 0;
    }

    try {
      const value = await this.redis.incr(key);
      
      if (ttl && value === 1) {
        // Set TTL only on first increment
        await this.redis.expire(key, ttl);
      }

      return value;

    } catch (error) {
      console.error(`Cache increment error for key ${key}:`, error);
      this.metrics.errors++;
      return 0;
    }
  }

  /**
   * Get or set pattern - cache-aside pattern
   */
  async getOrSet<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    ttl?: number
  ): Promise<T | null> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    try {
      // Fetch fresh data
      const fresh = await fetcher();
      
      // Cache the result
      await this.set(key, fresh, ttl);
      
      return fresh;

    } catch (error) {
      console.error(`Cache getOrSet error for key ${key}:`, error);
      this.metrics.errors++;
      return null;
    }
  }

  /**
   * Distributed lock implementation
   */
  async acquireLock(resource: string, ttl: number = 30): Promise<string | null> {
    if (!this.redis || !this.isConnected) {
      return null;
    }

    try {
      const lockKey = CACHE_KEYS.lock(resource);
      const lockValue = `${Date.now()}-${Math.random()}`;
      
      const result = await this.redis.set(lockKey, lockValue, 'EX', ttl, 'NX');
      
      return result === 'OK' ? lockValue : null;

    } catch (error) {
      console.error(`Lock acquisition error for ${resource}:`, error);
      this.metrics.errors++;
      return null;
    }
  }

  /**
   * Release distributed lock
   */
  async releaseLock(resource: string, lockValue: string): Promise<boolean> {
    if (!this.redis || !this.isConnected) {
      return false;
    }

    try {
      const lockKey = CACHE_KEYS.lock(resource);
      
      // Lua script to atomically check and delete lock
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = await this.redis.eval(script, 1, lockKey, lockValue);
      return result === 1;

    } catch (error) {
      console.error(`Lock release error for ${resource}:`, error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Rate limiting
   */
  async checkRateLimit(
    identifier: string, 
    limit: number, 
    window: number = 60
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    if (!this.redis || !this.isConnected) {
      return { allowed: true, remaining: limit - 1, resetTime: Date.now() + window * 1000 };
    }

    try {
      const key = CACHE_KEYS.rateLimit(identifier);
      const current = await this.increment(key, window);
      const remaining = Math.max(0, limit - current);
      const resetTime = Date.now() + window * 1000;

      return {
        allowed: current <= limit,
        remaining,
        resetTime,
      };

    } catch (error) {
      console.error(`Rate limit error for ${identifier}:`, error);
      this.metrics.errors++;
      return { allowed: true, remaining: limit - 1, resetTime: Date.now() + window * 1000 };
    }
  }

  /**
   * Cache invalidation helpers
   */
  async invalidateSession(sessionId: string): Promise<void> {
    await Promise.all([
      this.delete(CACHE_KEYS.session(sessionId)),
      this.delete(CACHE_KEYS.sessionAnswers(sessionId)),
      this.delete(CACHE_KEYS.sessionProgress(sessionId)),
      this.delete(CACHE_KEYS.chatMessages(sessionId)),
      this.delete(CACHE_KEYS.chatContext(sessionId)),
    ]);
  }

  async invalidateUser(userId: string): Promise<void> {
    await Promise.all([
      this.delete(CACHE_KEYS.userProfile(userId)),
      this.delete(CACHE_KEYS.userSessions(userId)),
      this.delete(CACHE_KEYS.userAnalytics(userId)),
    ]);
  }

  async invalidateGuest(anonymousId: string): Promise<void> {
    await Promise.all([
      this.delete(CACHE_KEYS.guestSession(anonymousId)),
      this.delete(CACHE_KEYS.guestProgress(anonymousId)),
    ]);
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      hitRatio: 0,
    };
  }

  /**
   * Update hit ratio
   */
  private updateHitRatio(): void {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRatio = total > 0 ? this.metrics.hits / total : 0;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ 
    status: 'healthy' | 'degraded' | 'unhealthy';
    connected: boolean;
    metrics: CacheMetrics;
    latency?: number;
  }> {
    if (!this.redis) {
      return {
        status: 'unhealthy',
        connected: false,
        metrics: this.getMetrics(),
      };
    }

    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;

      const status = latency < 50 ? 'healthy' : latency < 200 ? 'degraded' : 'unhealthy';

      return {
        status,
        connected: this.isConnected,
        metrics: this.getMetrics(),
        latency,
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        connected: false,
        metrics: this.getMetrics(),
      };
    }
  }

  /**
   * Cleanup and disconnect
   */
  async cleanup(): Promise<void> {
    if (this.redis) {
      await this.redis.disconnect();
      this.redis = null;
      this.isConnected = false;
      console.log('🔌 Cache service disconnected');
    }
  }
}

// Export singleton instance
export const cache = new CacheService();

// Initialize cache on import in non-test environments
if (process.env.NODE_ENV !== 'test') {
  cache.initialize().catch(console.error);
}