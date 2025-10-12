import { CacheService } from './cache.service';
import { RedisService } from '../redis/redis.service';

describe('CacheService', () => {
  let service: CacheService<string, any>;
  let redisService: RedisService;

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    keys: jest.fn(),
  };

  beforeEach(() => {
    redisService = mockRedisService as any;
    
    // Create cache service with test configuration
    service = new CacheService(redisService, {
      maxSize: 100,
      ttl: 1000, // 1 second for testing
      name: 'TestCache',
      useRedis: true,
      redisKeyPrefix: 'test-cache'
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Local Cache Operations', () => {
    it('should store and retrieve values from local cache', async () => {
      const key = 'test-key';
      const value = { data: 'test-value' };

      await service.set(key, value);
      const result = await service.get(key);

      expect(result).toEqual(value);
    });

    it('should return undefined for non-existent keys', async () => {
      const result = await service.get('non-existent-key');
      expect(result).toBeUndefined();
    });

    it('should handle TTL expiration', async () => {
      const key = 'ttl-test-key';
      const value = { data: 'ttl-test-value' };

      await service.set(key, value, 100); // 100ms TTL
      
      // Should be available immediately
      let result = await service.get(key);
      expect(result).toEqual(value);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      result = await service.get(key);
      expect(result).toBeUndefined();
    });

    it('should enforce maximum cache size (LRU eviction)', async () => {
      // Create a small cache for testing eviction
      const smallCache = new CacheService(redisService, {
        maxSize: 2,
        ttl: 5000,
        name: 'SmallTestCache',
        useRedis: false
      });

      await smallCache.set('key1', 'value1');
      await smallCache.set('key2', 'value2');
      await smallCache.set('key3', 'value3'); // Should evict key1

      expect(await smallCache.get('key1')).toBeUndefined(); // Evicted
      expect(await smallCache.get('key2')).toBe('value2');
      expect(await smallCache.get('key3')).toBe('value3');
    });
  });

  describe('Redis Integration', () => {
    it('should store values in both local cache and Redis', async () => {
      const key = 'redis-test-key';
      const value = { data: 'redis-test-value' };

      mockRedisService.set.mockResolvedValue(undefined);

      await service.set(key, value);

      expect(mockRedisService.set).toHaveBeenCalledWith(
        'test-cache:testcache:redis-test-key',
        JSON.stringify(value),
        1 // TTL in seconds
      );
    });

    it('should retrieve from Redis when not in local cache', async () => {
      const key = 'redis-retrieve-key';
      const value = { data: 'redis-retrieve-value' };

      mockRedisService.get.mockResolvedValue(JSON.stringify(value));

      const result = await service.get(key);

      expect(mockRedisService.get).toHaveBeenCalledWith('test-cache:testcache:redis-retrieve-key');
      expect(result).toEqual(value);
    });

    it('should handle Redis failures gracefully', async () => {
      const key = 'redis-fail-key';
      const value = { data: 'redis-fail-value' };

      mockRedisService.set.mockRejectedValue(new Error('Redis connection failed'));

      // Should not throw error, just log warning
      await expect(service.set(key, value)).resolves.not.toThrow();
      
      // Local cache should still work
      const result = await service.get(key);
      expect(result).toEqual(value);
    });

    it('should delete from both local cache and Redis', async () => {
      const key = 'delete-test-key';

      mockRedisService.delete.mockResolvedValue(undefined);

      await service.delete(key);

      expect(mockRedisService.delete).toHaveBeenCalledWith('test-cache:testcache:delete-test-key');
    });
  });

  describe('Cache Statistics', () => {
    it('should track hit and miss statistics', async () => {
      // Mock Redis to return null for miss-key
      mockRedisService.get.mockImplementation((key) => {
        if (key.includes('miss-key')) {
          return Promise.resolve(null);
        }
        return Promise.resolve(undefined);
      });

      // Generate some hits and misses
      await service.set('hit-key', 'hit-value');
      
      await service.get('hit-key'); // Local hit
      await service.get('hit-key'); // Local hit
      await service.get('miss-key'); // Local miss, Redis miss
      await service.get('miss-key'); // Local miss, Redis miss

      const stats = service.getStats();

      expect(stats.localHits).toBe(2);
      expect(stats.localMisses).toBe(2);
      expect(stats.redisMisses).toBe(2);
    });

    it('should provide comprehensive cache info', async () => {
      const info = service.getCacheInfo();

      expect(info).toHaveProperty('name', 'TestCache');
      expect(info).toHaveProperty('stats');
      expect(info).toHaveProperty('uptime');
      expect(info).toHaveProperty('memoryPressure');
      expect(info).toHaveProperty('isHealthy');
      expect(info).toHaveProperty('redisEnabled', true);
    });

    it('should generate Prometheus metrics', async () => {
      const metrics = service.getMetrics();

      expect(metrics).toHaveProperty('cache_hits_total');
      expect(metrics).toHaveProperty('cache_misses_total');
      expect(metrics).toHaveProperty('cache_size_current');
      expect(metrics).toHaveProperty('cache_memory_usage_bytes');
      expect(metrics).toHaveProperty('cache_hit_ratio_percent');
      expect(metrics).toHaveProperty('cache_healthy');
      expect(metrics).toHaveProperty('cache_name', 'TestCache');
      expect(metrics).toHaveProperty('service_name', 'auth-service');
    });
  });

  describe('Memory Management', () => {
    it('should calculate memory usage correctly', async () => {
      const largeValue = { data: 'x'.repeat(1000) }; // ~1KB value
      
      await service.set('large-key', largeValue);
      
      const stats = service.getStats();
      expect(stats.memoryUsage).toBeGreaterThan(1000); // Should be > 1KB
    });

    it('should detect memory pressure', async () => {
      // Create cache with very small size to trigger pressure
      const tinyCache = new CacheService(redisService, {
        maxSize: 1,
        ttl: 5000,
        name: 'TinyCache',
        useRedis: false
      });

      await tinyCache.set('key1', 'value1');
      
      const info = tinyCache.getCacheInfo();
      expect(info.memoryPressure).toBe(1.0); // 100% full
      expect(info.isHealthy).toBe(false); // Should be unhealthy when > 90% full
    });
  });

  describe('Cache Cleanup', () => {
    it('should clear all cache entries', async () => {
      await service.set('clear-key1', 'value1');
      await service.set('clear-key2', 'value2');

      mockRedisService.keys.mockResolvedValue(['test-cache:testcache:clear-key1', 'test-cache:testcache:clear-key2']);
      mockRedisService.delete.mockResolvedValue(undefined);
      // Make sure Redis returns null after clearing
      mockRedisService.get.mockResolvedValue(null);

      await service.clear();

      expect(await service.get('clear-key1')).toBeUndefined();
      expect(await service.get('clear-key2')).toBeUndefined();
      expect(mockRedisService.keys).toHaveBeenCalledWith('test-cache:testcache:*');
    });

    it('should purge stale entries', () => {
      // This tests the LRU cache's built-in purgeStale functionality
      expect(() => service.purgeStale()).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle serialization errors', async () => {
      const circularValue = {};
      (circularValue as any).self = circularValue; // Create circular reference

      // The service logs errors but doesn't throw them, it continues with local cache only
      await expect(service.set('circular-key', circularValue)).resolves.not.toThrow();
      
      // Should still be able to get from local cache
      const result = await service.get('circular-key');
      expect(result).toEqual(circularValue);
    });

    it('should handle deserialization errors', async () => {
      mockRedisService.get.mockResolvedValue('invalid-json{');

      // The service logs errors but doesn't throw them, it returns undefined
      const result = await service.get('invalid-json-key');
      expect(result).toBeUndefined();
    });

    it('should handle Redis connection errors gracefully', async () => {
      mockRedisService.get.mockRejectedValue(new Error('Connection timeout'));

      const result = await service.get('connection-error-key');
      expect(result).toBeUndefined();
    });
  });
});