// Rate Limiting Service - Task 3.2: Security Hardening
// Prevents abuse with Redis-backed rate limiting

import { cache } from '../cache';

export interface RateLimitConfig {
  windowMs: number;    // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (identifier: string) => string;
  onLimitReached?: (identifier: string) => void;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter: number;
}

/**
 * Rate limiting configurations for different endpoints
 */
export const RATE_LIMITS = {
  // General API rate limits
  API_GENERAL: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    maxRequests: 1000,         // 1000 requests per 15 minutes
  },
  
  // Authentication rate limits
  AUTH_LOGIN: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    maxRequests: 5,            // 5 login attempts per 15 minutes
  },
  
  AUTH_SIGNUP: {
    windowMs: 60 * 60 * 1000,  // 1 hour
    maxRequests: 3,            // 3 signup attempts per hour
  },
  
  // Wizard/session rate limits
  WIZARD_SAVE: {
    windowMs: 60 * 60 * 1000,  // 1 hour
    maxRequests: 100,          // 100 saves per hour
  },
  
  WIZARD_SUBMIT: {
    windowMs: 60 * 60 * 1000,  // 1 hour
    maxRequests: 5,            // 5 submissions per hour
  },
  
  // Chat rate limits
  CHAT_MESSAGE: {
    windowMs: 60 * 1000,       // 1 minute
    maxRequests: 20,           // 20 messages per minute
  },
  
  CHAT_CONTEXT: {
    windowMs: 60 * 1000,       // 1 minute
    maxRequests: 30,           // 30 context requests per minute
  },
  
  // PDF generation rate limits
  PDF_GENERATE: {
    windowMs: 60 * 60 * 1000,  // 1 hour
    maxRequests: 10,           // 10 PDF generations per hour
  },
  
  // Email rate limits
  EMAIL_SEND: {
    windowMs: 60 * 60 * 1000,  // 1 hour
    maxRequests: 5,            // 5 emails per hour
  },
  
  // Admin operations
  ADMIN_API: {
    windowMs: 60 * 1000,       // 1 minute
    maxRequests: 60,           // 60 admin API calls per minute
  },
  
  // Guest user specific limits
  GUEST_SESSION: {
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    maxRequests: 50,               // 50 actions per day for guests
  },
} as const;

export class RateLimiter {
  private defaultConfig: RateLimitConfig = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    keyGenerator: (identifier) => `rate_limit:${identifier}`,
  };

  /**
   * Check if request is within rate limits
   */
  async checkRateLimit(
    identifier: string,
    config: Partial<RateLimitConfig> = {}
  ): Promise<RateLimitResult> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const key = finalConfig.keyGenerator!(identifier);
    const windowMs = finalConfig.windowMs;
    const maxRequests = finalConfig.maxRequests;

    try {
      // Use Redis-based sliding window rate limiter
      const result = await cache.checkRateLimit(
        identifier,
        maxRequests,
        Math.floor(windowMs / 1000)
      );

      const retryAfter = result.allowed ? 0 : Math.ceil(windowMs / 1000);

      if (!result.allowed && finalConfig.onLimitReached) {
        finalConfig.onLimitReached(identifier);
      }

      return {
        allowed: result.allowed,
        limit: maxRequests,
        remaining: result.remaining,
        resetTime: result.resetTime,
        retryAfter,
      };

    } catch (error) {
      console.error('Rate limiting error:', error);
      
      // Fail open - allow request if rate limiter is down
      return {
        allowed: true,
        limit: maxRequests,
        remaining: maxRequests - 1,
        resetTime: Date.now() + windowMs,
        retryAfter: 0,
      };
    }
  }

  /**
   * Middleware factory for different rate limit types
   */
  createMiddleware(limitType: keyof typeof RATE_LIMITS, identifierFn?: (req: Request) => string) {
    const config = RATE_LIMITS[limitType];
    
    return async (request: Request): Promise<Response | null> => {
      // Generate identifier (IP, user ID, session ID, etc.)
      const identifier = identifierFn ? 
        identifierFn(request) : 
        this.getDefaultIdentifier(request);

      const result = await this.checkRateLimit(identifier, config);

      if (!result.allowed) {
        console.warn(`Rate limit exceeded for ${limitType}: ${identifier}`);
        
        return new Response(JSON.stringify({
          error: 'Rate limit exceeded',
          message: `Too many requests. Try again in ${result.retryAfter} seconds.`,
          limit: result.limit,
          remaining: result.remaining,
          resetTime: result.resetTime,
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': result.limit.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': result.resetTime.toString(),
            'Retry-After': result.retryAfter.toString(),
          },
        });
      }

      // Add rate limit headers to successful responses
      return null; // Continue to next middleware
    };
  }

  /**
   * Get default identifier from request
   */
  private getDefaultIdentifier(request: Request): string {
    const url = new URL(request.url);
    
    // Try to get client IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 
              request.headers.get('x-real-ip') || 
              'unknown';

    // Include user agent for additional fingerprinting
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const fingerprint = this.hashString(ip + userAgent);

    return fingerprint;
  }

  /**
   * Simple hash function for fingerprinting
   */
  private hashString(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  /**
   * Rate limit based on user ID
   */
  async checkUserRateLimit(
    userId: string,
    limitType: keyof typeof RATE_LIMITS
  ): Promise<RateLimitResult> {
    const config = RATE_LIMITS[limitType];
    const identifier = `user:${userId}`;
    
    return this.checkRateLimit(identifier, config);
  }

  /**
   * Rate limit based on session ID (for guests)
   */
  async checkSessionRateLimit(
    sessionId: string,
    limitType: keyof typeof RATE_LIMITS
  ): Promise<RateLimitResult> {
    const config = RATE_LIMITS[limitType];
    const identifier = `session:${sessionId}`;
    
    return this.checkRateLimit(identifier, config);
  }

  /**
   * Rate limit based on IP address
   */
  async checkIPRateLimit(
    ip: string,
    limitType: keyof typeof RATE_LIMITS
  ): Promise<RateLimitResult> {
    const config = RATE_LIMITS[limitType];
    const identifier = `ip:${ip}`;
    
    return this.checkRateLimit(identifier, config);
  }

  /**
   * Combined rate limiting (user + IP)
   */
  async checkCombinedRateLimit(
    userId: string | null,
    ip: string,
    limitType: keyof typeof RATE_LIMITS
  ): Promise<RateLimitResult> {
    const config = RATE_LIMITS[limitType];
    
    // Check both user and IP rate limits
    const userResult = userId ? 
      await this.checkUserRateLimit(userId, limitType) :
      { allowed: true, limit: config.maxRequests, remaining: config.maxRequests, resetTime: 0, retryAfter: 0 };
    
    const ipResult = await this.checkIPRateLimit(ip, limitType);

    // Return the most restrictive result
    if (!userResult.allowed || !ipResult.allowed) {
      return {
        allowed: false,
        limit: Math.min(userResult.limit, ipResult.limit),
        remaining: Math.min(userResult.remaining, ipResult.remaining),
        resetTime: Math.max(userResult.resetTime, ipResult.resetTime),
        retryAfter: Math.max(userResult.retryAfter, ipResult.retryAfter),
      };
    }

    return {
      allowed: true,
      limit: Math.min(userResult.limit, ipResult.limit),
      remaining: Math.min(userResult.remaining, ipResult.remaining),
      resetTime: Math.max(userResult.resetTime, ipResult.resetTime),
      retryAfter: 0,
    };
  }

  /**
   * Get current rate limit status without incrementing
   */
  async getRateLimitStatus(
    identifier: string,
    limitType: keyof typeof RATE_LIMITS
  ): Promise<{
    limit: number;
    remaining: number;
    resetTime: number;
  }> {
    const config = RATE_LIMITS[limitType];
    const key = `rate_limit:${identifier}`;
    
    try {
      // Get current count without incrementing
      const current = await cache.get<number>(key) || 0;
      const remaining = Math.max(0, config.maxRequests - current);
      const resetTime = Date.now() + config.windowMs;

      return {
        limit: config.maxRequests,
        remaining,
        resetTime,
      };

    } catch (error) {
      console.error('Error getting rate limit status:', error);
      return {
        limit: config.maxRequests,
        remaining: config.maxRequests,
        resetTime: Date.now() + config.windowMs,
      };
    }
  }

  /**
   * Reset rate limit for specific identifier
   */
  async resetRateLimit(
    identifier: string,
    limitType: keyof typeof RATE_LIMITS
  ): Promise<boolean> {
    try {
      const key = `rate_limit:${identifier}`;
      await cache.delete(key);
      return true;
    } catch (error) {
      console.error('Error resetting rate limit:', error);
      return false;
    }
  }

  /**
   * Whitelist an identifier (bypass rate limits)
   */
  async addToWhitelist(identifier: string): Promise<void> {
    const key = `rate_limit:whitelist:${identifier}`;
    await cache.set(key, true, 24 * 60 * 60); // 24 hours
  }

  /**
   * Check if identifier is whitelisted
   */
  async isWhitelisted(identifier: string): Promise<boolean> {
    const key = `rate_limit:whitelist:${identifier}`;
    const whitelisted = await cache.get<boolean>(key);
    return !!whitelisted;
  }

  /**
   * Get rate limiting statistics
   */
  async getStatistics(period: 'hour' | 'day' = 'hour'): Promise<{
    totalRequests: number;
    blockedRequests: number;
    uniqueIdentifiers: number;
    topLimitedEndpoints: Array<{ endpoint: string; count: number }>;
  }> {
    try {
      // This would require more sophisticated tracking
      // For now, return basic stats from cache metrics
      const cacheMetrics = cache.getMetrics();
      
      return {
        totalRequests: cacheMetrics.hits + cacheMetrics.misses,
        blockedRequests: 0, // Would need to track this separately
        uniqueIdentifiers: 0, // Would need to track this separately
        topLimitedEndpoints: [], // Would need to track this separately
      };

    } catch (error) {
      console.error('Error getting rate limit statistics:', error);
      return {
        totalRequests: 0,
        blockedRequests: 0,
        uniqueIdentifiers: 0,
        topLimitedEndpoints: [],
      };
    }
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();