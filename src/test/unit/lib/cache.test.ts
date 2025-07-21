// Cache Service Unit Tests - Task 3.3: Testing Suite
// Comprehensive tests for Redis-backed caching

import { describe, test, expect, beforeEach, vi, Mock } from 'vitest';

// Mock Redis implementation
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  expire: vi.fn(),
  eval: vi.fn(),
  ping: vi.fn(),
  quit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

// Mock IORedis module
vi.mock('ioredis', () => ({
  default: vi.fn(() => mockRedis),
}));

// Import after mocking
const { CacheService, CACHE_TTL } = await import('@/lib/cache');

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    vi.clearAllMocks();
    cacheService = new CacheService();
  });

  describe('initialization', () => {
    test('creates Redis connection with default config', () => {
      expect(cacheService).toBeInstanceOf(CacheService);
    });

    test('handles Redis connection events', () => {
      expect(mockRedis.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('ready', expect.any(Function));
    });
  });

  describe('basic operations', () => {
    test('get - retrieves value from cache', async () => {
      const testValue = JSON.stringify({ data: 'test' });
      mockRedis.get.mockResolvedValue(testValue);

      const result = await cacheService.get('test-key');

      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
      expect(result).toEqual({ data: 'test' });
    });

    test('get - returns null for non-existent key', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheService.get('non-existent');

      expect(result).toBeNull();
    });

    test('get - handles JSON parsing errors', async () => {
      mockRedis.get.mockResolvedValue('invalid-json');

      const result = await cacheService.get('invalid-key');

      expect(result).toBeNull();
    });

    test('set - stores value in cache with TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');
      const testData = { data: 'test' };

      const result = await cacheService.set('test-key', testData, 300);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(testData),
        'EX',
        300
      );
      expect(result).toBe(true);
    });

    test('set - handles Redis errors', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.set('test-key', { data: 'test' });

      expect(result).toBe(false);
    });

    test('delete - removes key from cache', async () => {
      mockRedis.del.mockResolvedValue(1);

      const result = await cacheService.delete('test-key');

      expect(mockRedis.del).toHaveBeenCalledWith('test-key');
      expect(result).toBe(true);
    });

    test('delete - returns false when key does not exist', async () => {
      mockRedis.del.mockResolvedValue(0);

      const result = await cacheService.delete('non-existent');

      expect(result).toBe(false);
    });

    test('exists - checks if key exists', async () => {
      mockRedis.exists.mockResolvedValue(1);

      const result = await cacheService.exists('test-key');

      expect(mockRedis.exists).toHaveBeenCalledWith('test-key');
      expect(result).toBe(true);
    });
  });

  describe('getOrSet functionality', () => {
    test('returns cached value when available', async () => {
      const cachedValue = { data: 'cached' };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedValue));

      const fetcher = vi.fn();
      const result = await cacheService.getOrSet('test-key', fetcher, 300);

      expect(result).toEqual(cachedValue);
      expect(fetcher).not.toHaveBeenCalled();
      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
    });

    test('fetches and caches value when not in cache', async () => {
      const fetchedValue = { data: 'fetched' };
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      const fetcher = vi.fn().mockResolvedValue(fetchedValue);
      const result = await cacheService.getOrSet('test-key', fetcher, 300);

      expect(result).toEqual(fetchedValue);
      expect(fetcher).toHaveBeenCalled();
      expect(mockRedis.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(fetchedValue),
        'EX',
        300
      );
    });

    test('handles fetcher errors gracefully', async () => {
      mockRedis.get.mockResolvedValue(null);
      const fetcherError = new Error('Fetcher failed');
      const fetcher = vi.fn().mockRejectedValue(fetcherError);

      await expect(cacheService.getOrSet('test-key', fetcher)).rejects.toThrow('Fetcher failed');
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    test('uses default TTL when not specified', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      const fetcher = vi.fn().mockResolvedValue({ data: 'test' });
      await cacheService.getOrSet('test-key', fetcher);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify({ data: 'test' }),
        'EX',
        300 // Default TTL
      );
    });
  });

  describe('rate limiting', () => {
    test('checkRateLimit - allows requests within limit', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      mockRedis.eval.mockResolvedValue([5, currentTime + 300]); // 5 requests, reset in 300s

      const result = await cacheService.checkRateLimit('user123', 10, 300);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5); // 10 - 5
      expect(result.resetTime).toBe((currentTime + 300) * 1000);
    });

    test('checkRateLimit - blocks requests exceeding limit', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      mockRedis.eval.mockResolvedValue([0, currentTime + 300]); // No requests remaining

      const result = await cacheService.checkRateLimit('user123', 10, 300);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    test('checkRateLimit - handles Redis errors by allowing request', async () => {
      mockRedis.eval.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.checkRateLimit('user123', 10, 300);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
    });

    test('checkRateLimit - uses correct Lua script', async () => {
      mockRedis.eval.mockResolvedValue([5, Math.floor(Date.now() / 1000) + 300]);

      await cacheService.checkRateLimit('user123', 10, 300);

      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining('local key = KEYS[1]'),
        1,
        'rate_limit:user123',
        10,
        300,
        expect.any(Number)
      );
    });
  });

  describe('session caching', () => {
    test('getSession - retrieves session from cache', async () => {
      const sessionData = {
        id: 'session123',
        userId: 'user123',
        createdAt: new Date().toISOString(),
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(sessionData));

      const result = await cacheService.getSession('session123');

      expect(mockRedis.get).toHaveBeenCalledWith('session:session123');
      expect(result).toEqual(sessionData);
    });

    test('setSession - stores session with default TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');
      const sessionData = {
        id: 'session123',
        userId: 'user123',
      };

      const result = await cacheService.setSession('session123', sessionData);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'session:session123',
        JSON.stringify(sessionData),
        'EX',
        CACHE_TTL.SESSION
      );
      expect(result).toBe(true);
    });

    test('deleteSession - removes session from cache', async () => {
      mockRedis.del.mockResolvedValue(1);

      const result = await cacheService.deleteSession('session123');

      expect(mockRedis.del).toHaveBeenCalledWith('session:session123');
      expect(result).toBe(true);
    });
  });

  describe('query result caching', () => {
    test('getCachedQuery - retrieves cached query result', async () => {
      const queryResult = { rows: [{ id: 1, name: 'Test' }] };
      mockRedis.get.mockResolvedValue(JSON.stringify(queryResult));

      const result = await cacheService.getCachedQuery('SELECT * FROM users');

      expect(result).toEqual(queryResult);
    });

    test('setCachedQuery - stores query result with default TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');
      const queryResult = { rows: [{ id: 1, name: 'Test' }] };

      const result = await cacheService.setCachedQuery('SELECT * FROM users', queryResult);

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('query:'),
        JSON.stringify(queryResult),
        'EX',
        CACHE_TTL.QUERY_RESULTS
      );
    });

    test('invalidateQuery - removes cached query', async () => {
      mockRedis.del.mockResolvedValue(1);

      const result = await cacheService.invalidateQuery('SELECT * FROM users');

      expect(result).toBe(true);
    });
  });

  describe('health monitoring', () => {
    test('isHealthy - returns true when Redis is connected', async () => {
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await cacheService.isHealthy();

      expect(result).toBe(true);
    });

    test('isHealthy - returns false when Redis is not responding', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection failed'));

      const result = await cacheService.isHealthy();

      expect(result).toBe(false);
    });

    test('getStats - returns cache statistics', () => {
      const stats = cacheService.getStats();

      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRatio');
      expect(stats).toHaveProperty('operations');
      expect(typeof stats.hits).toBe('number');
      expect(typeof stats.misses).toBe('number');
      expect(typeof stats.hitRatio).toBe('number');
    });

    test('getMetrics - returns detailed metrics', () => {
      const metrics = cacheService.getMetrics();

      expect(metrics).toHaveProperty('hits');
      expect(metrics).toHaveProperty('misses');
      expect(metrics).toHaveProperty('sets');
      expect(metrics).toHaveProperty('deletes');
      expect(metrics).toHaveProperty('errors');
      expect(metrics).toHaveProperty('hitRatio');
    });
  });

  describe('connection management', () => {
    test('disconnect - closes Redis connection', async () => {
      mockRedis.quit.mockResolvedValue('OK');

      await cacheService.disconnect();

      expect(mockRedis.quit).toHaveBeenCalled();
    });

    test('disconnect - handles Redis errors', async () => {
      mockRedis.quit.mockRejectedValue(new Error('Quit failed'));

      // Should not throw
      await expect(cacheService.disconnect()).resolves.toBeUndefined();
    });
  });

  describe('error handling and fallbacks', () => {
    test('gracefully handles Redis connection errors', async () => {
      mockRedis.get.mockRejectedValue(new Error('Connection lost'));

      const result = await cacheService.get('test-key');

      expect(result).toBeNull();
    });

    test('continues operation when cache is unavailable', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis unavailable'));

      const fetcher = vi.fn().mockResolvedValue({ data: 'fetched' });
      const result = await cacheService.getOrSet('test-key', fetcher);

      expect(result).toEqual({ data: 'fetched' });
      expect(fetcher).toHaveBeenCalled();
    });

    test('tracks error metrics', async () => {
      mockRedis.get.mockRejectedValue(new Error('Test error'));

      await cacheService.get('test-key');

      const metrics = cacheService.getMetrics();
      expect(metrics.errors).toBeGreaterThan(0);
    });
  });

  describe('cache invalidation patterns', () => {
    test('invalidatePattern - removes keys matching pattern', async () => {
      const mockScan = vi.fn().mockResolvedValue(['0', ['user:123', 'user:456']]);
      mockRedis.scan = mockScan;
      mockRedis.del.mockResolvedValue(2);

      const result = await cacheService.invalidatePattern('user:*');

      expect(mockScan).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledWith('user:123', 'user:456');
      expect(result).toBe(2);
    });

    test('flushAll - clears entire cache', async () => {
      const mockFlushAll = vi.fn().mockResolvedValue('OK');
      mockRedis.flushall = mockFlushAll;

      await cacheService.flushAll();

      expect(mockFlushAll).toHaveBeenCalled();
    });
  });

  describe('cache warming', () => {
    test('warmCache - preloads cache with data', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const cacheData = [
        { key: 'user:1', value: { id: 1, name: 'User 1' }, ttl: 300 },
        { key: 'user:2', value: { id: 2, name: 'User 2' }, ttl: 300 },
      ];

      await cacheService.warmCache(cacheData);

      expect(mockRedis.set).toHaveBeenCalledTimes(2);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'user:1',
        JSON.stringify({ id: 1, name: 'User 1' }),
        'EX',
        300
      );
    });
  });

  describe('CACHE_TTL constants', () => {
    test('has correct TTL values', () => {
      expect(CACHE_TTL.SESSION).toBe(5 * 60); // 5 minutes
      expect(CACHE_TTL.USER_PROFILE).toBe(15 * 60); // 15 minutes
      expect(CACHE_TTL.WIZARD_CONFIG).toBe(60 * 60); // 1 hour
      expect(CACHE_TTL.QUERY_RESULTS).toBe(1 * 60); // 1 minute
    });

    test('all TTL values are positive', () => {
      Object.values(CACHE_TTL).forEach(ttl => {
        expect(ttl).toBeGreaterThan(0);
      });
    });
  });

  describe('cache key generation', () => {
    test('generates consistent keys for same input', () => {
      const query1 = 'SELECT * FROM users WHERE id = 1';
      const query2 = 'SELECT * FROM users WHERE id = 1';

      // Test through setCachedQuery to see if keys are consistent
      cacheService.setCachedQuery(query1, { result: 'test' });
      cacheService.setCachedQuery(query2, { result: 'test' });

      // Should have been called with the same key both times
      const calls = (mockRedis.set as Mock).mock.calls;
      expect(calls.length).toBe(2);
      expect(calls[0][0]).toBe(calls[1][0]); // Same key
    });

    test('generates different keys for different queries', () => {
      const query1 = 'SELECT * FROM users WHERE id = 1';
      const query2 = 'SELECT * FROM users WHERE id = 2';

      cacheService.setCachedQuery(query1, { result: 'test1' });
      cacheService.setCachedQuery(query2, { result: 'test2' });

      const calls = (mockRedis.set as Mock).mock.calls;
      expect(calls.length).toBe(2);
      expect(calls[0][0]).not.toBe(calls[1][0]); // Different keys
    });
  });
});