import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;
  let cacheManager: Cache;

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    cacheManager = module.get<Cache>(CACHE_MANAGER);
    jest.clearAllMocks();
    service.resetStats(); // Reset stats for each test
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('get', () => {
    it('should return cached value and track hit', async () => {
      const key = 'test-key';
      const value = { data: 'test' };
      mockCacheManager.get.mockResolvedValue(value);

      const result = await service.get(key);

      expect(result).toEqual(value);
      expect(mockCacheManager.get).toHaveBeenCalledWith(key);

      const stats = service.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(0);
    });

    it('should return undefined for non-existent key and track miss', async () => {
      const key = 'non-existent';
      mockCacheManager.get.mockResolvedValue(undefined);

      const result = await service.get(key);

      expect(result).toBeUndefined();
      expect(mockCacheManager.get).toHaveBeenCalledWith(key);

      const stats = service.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(1);
    });

    it('should handle cache errors gracefully', async () => {
      const key = 'error-key';
      mockCacheManager.get.mockRejectedValue(new Error('Cache error'));

      const result = await service.get(key);

      expect(result).toBeUndefined();

      const stats = service.getStats();
      expect(stats.misses).toBe(1);
    });
  });

  describe('set', () => {
    it('should set value with explicit TTL', async () => {
      const key = 'test-key';
      const value = { data: 'test' };
      const ttl = 300;

      await service.set(key, value, ttl);

      expect(mockCacheManager.set).toHaveBeenCalledWith(key, value, ttl);
    });

    it('should set value with automatic TTL based on key pattern', async () => {
      const key = 'library_user123_page1';
      const value = { data: 'test' };

      await service.set(key, value);

      expect(mockCacheManager.set).toHaveBeenCalledWith(key, value, 300); // library pattern TTL
    });

    it('should set value with default TTL for unknown patterns', async () => {
      const key = 'unknown_pattern_key';
      const value = { data: 'test' };

      await service.set(key, value);

      expect(mockCacheManager.set).toHaveBeenCalledWith(key, value, 300); // default TTL
    });

    it('should handle set errors gracefully', async () => {
      const key = 'error-key';
      const value = { data: 'test' };
      mockCacheManager.set.mockRejectedValue(new Error('Set error'));

      await expect(service.set(key, value)).resolves.not.toThrow();
    });
  });

  describe('del', () => {
    it('should delete cached value', async () => {
      const key = 'test-key';

      await service.del(key);

      expect(mockCacheManager.del).toHaveBeenCalledWith(key);
    });

    it('should handle delete errors gracefully', async () => {
      const key = 'error-key';
      mockCacheManager.del.mockRejectedValue(new Error('Delete error'));

      await expect(service.del(key)).resolves.not.toThrow();
    });
  });

  describe('getOrSet', () => {
    it('should return cached data if it exists', async () => {
      const key = 'my-key';
      const cachedData = { value: 'from-cache' };
      mockCacheManager.get.mockResolvedValue(cachedData);
      const fn = jest.fn();

      const result = await service.getOrSet(key, fn, 300);

      expect(result).toEqual(cachedData);
      expect(mockCacheManager.get).toHaveBeenCalledWith(key);
      expect(fn).not.toHaveBeenCalled();
      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });

    it('should execute function and set cache if data does not exist', async () => {
      const key = 'my-key';
      const newData = { value: 'from-function' };
      mockCacheManager.get.mockResolvedValue(undefined);
      const fn = jest.fn().mockResolvedValue(newData);

      const result = await service.getOrSet(key, fn, 300);

      expect(result).toEqual(newData);
      expect(mockCacheManager.get).toHaveBeenCalledWith(key);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(mockCacheManager.set).toHaveBeenCalledWith(key, newData, 300);
    });

    it('should handle function errors', async () => {
      const key = 'my-key';
      const error = new Error('Function failed');
      mockCacheManager.get.mockResolvedValue(undefined);
      const fn = jest.fn().mockRejectedValue(error);

      await expect(service.getOrSet(key, fn, 300)).rejects.toThrow(error);

      expect(mockCacheManager.get).toHaveBeenCalledWith(key);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });
  });

  describe('mget', () => {
    it('should get multiple values', async () => {
      const keys = ['key1', 'key2', 'key3'];
      const values = [{ data: 'value1' }, { data: 'value2' }, undefined];

      mockCacheManager.get
        .mockResolvedValueOnce(values[0])
        .mockResolvedValueOnce(values[1])
        .mockResolvedValueOnce(values[2]);

      const result = await service.mget(keys);

      expect(result.size).toBe(2);
      expect(result.get('key1')).toEqual(values[0]);
      expect(result.get('key2')).toEqual(values[1]);
      expect(result.has('key3')).toBe(false);
    });

    it('should handle errors in bulk get', async () => {
      const keys = ['key1', 'key2'];
      mockCacheManager.get.mockRejectedValue(new Error('Get error'));

      const result = await service.mget(keys);

      expect(result.size).toBe(0);
    });
  });

  describe('mset', () => {
    it('should set multiple values', async () => {
      const entries = [
        { key: 'key1', value: { data: 'value1' }, ttl: 300 },
        { key: 'key2', value: { data: 'value2' } },
      ];

      await service.mset(entries);

      expect(mockCacheManager.set).toHaveBeenCalledWith('key1', entries[0].value, 300);
      expect(mockCacheManager.set).toHaveBeenCalledWith('key2', entries[1].value, 300); // default TTL
    });

    it('should handle errors in bulk set', async () => {
      const entries = [{ key: 'key1', value: { data: 'value1' } }];
      mockCacheManager.set.mockRejectedValue(new Error('Set error'));

      await expect(service.mset(entries)).resolves.not.toThrow();
    });
  });

  describe('recordUserCacheKey', () => {
    it('should record cache key for user', async () => {
      const userId = 'user123';
      const key = 'library_user123_page1';

      mockCacheManager.get.mockResolvedValue(undefined); // No existing keys

      await service.recordUserCacheKey(userId, key);

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        `user-cache-keys:${userId}`,
        [key],
        0
      );
    });

    it('should not duplicate existing keys', async () => {
      const userId = 'user123';
      const key = 'library_user123_page1';
      const existingKeys = [key, 'other_key'];

      mockCacheManager.get.mockResolvedValue(existingKeys);

      await service.recordUserCacheKey(userId, key);

      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });

    it('should limit tracked keys to 100', async () => {
      const userId = 'user123';
      const key = 'new_key';
      const existingKeys = Array.from({ length: 100 }, (_, i) => `key${i}`);

      mockCacheManager.get.mockResolvedValue(existingKeys);

      await service.recordUserCacheKey(userId, key);

      // Should call set with some array that includes the new key
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        `user-cache-keys:${userId}`,
        expect.arrayContaining(['new_key']),
        0
      );
      
      // Should limit to 100 keys
      const setCall = mockCacheManager.set.mock.calls.find(call => call[0] === `user-cache-keys:${userId}`);
      expect(setCall[1]).toHaveLength(100);
    });
  });

  describe('invalidateUserCache', () => {
    it('should invalidate all user cache keys', async () => {
      const userId = 'user123';
      const keysToDelete = ['key1', 'key2', 'key3'];

      mockCacheManager.get.mockResolvedValue(keysToDelete);

      await service.invalidateUserCache(userId);

      keysToDelete.forEach(key => {
        expect(mockCacheManager.del).toHaveBeenCalledWith(key);
      });
      expect(mockCacheManager.del).toHaveBeenCalledWith(`user-cache-keys:${userId}`);
    });

    it('should handle empty user cache keys', async () => {
      const userId = 'user123';

      mockCacheManager.get.mockResolvedValue(undefined);

      await service.invalidateUserCache(userId);

      expect(mockCacheManager.del).toHaveBeenCalledWith(`user-cache-keys:${userId}`);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      // Generate some hits and misses
      mockCacheManager.get
        .mockResolvedValueOnce({ data: 'hit1' })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ data: 'hit2' });

      await service.get('key1'); // hit
      await service.get('key2'); // miss
      await service.get('key3'); // hit

      const stats = service.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.totalOperations).toBe(3);
      expect(stats.hitRate).toBe(0.67);
    });

    it('should handle zero operations', () => {
      const stats = service.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.totalOperations).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('resetStats', () => {
    it('should reset statistics', async () => {
      mockCacheManager.get.mockResolvedValue({ data: 'hit' });
      await service.get('key1'); // Generate a hit

      let stats = service.getStats();
      expect(stats.hits).toBe(1);

      service.resetStats();

      stats = service.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('getCachePatterns', () => {
    it('should return cache patterns configuration', () => {
      const patterns = service.getCachePatterns();

      expect(patterns).toHaveProperty('library');
      expect(patterns).toHaveProperty('search');
      expect(patterns).toHaveProperty('gameDetails');
      expect(patterns.library.ttl).toBe(300);
      expect(patterns.search.ttl).toBe(300);
    });
  });

  describe('warmUp', () => {
    it('should warm up cache with provided functions', async () => {
      const warmUpFunctions = [
        {
          key: 'warm-key1',
          fn: jest.fn().mockResolvedValue({ data: 'warm1' }),
          ttl: 600,
        },
        {
          key: 'warm-key2',
          fn: jest.fn().mockResolvedValue({ data: 'warm2' }),
        },
      ];

      mockCacheManager.get.mockResolvedValue(undefined); // No existing data

      await service.warmUp(warmUpFunctions);

      expect(mockCacheManager.set).toHaveBeenCalledWith('warm-key1', { data: 'warm1' }, 600);
      expect(mockCacheManager.set).toHaveBeenCalledWith('warm-key2', { data: 'warm2' }, 300);
    });

    it('should skip warm up for existing keys', async () => {
      const warmUpFunctions = [
        {
          key: 'existing-key',
          fn: jest.fn().mockResolvedValue({ data: 'new' }),
        },
      ];

      mockCacheManager.get.mockResolvedValue({ data: 'existing' }); // Existing data

      await service.warmUp(warmUpFunctions);

      expect(warmUpFunctions[0].fn).not.toHaveBeenCalled();
      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when cache operations work', async () => {
      let storedValue: any;

      mockCacheManager.set.mockImplementation(async (key, value) => {
        storedValue = value;
        return undefined;
      });

      mockCacheManager.get.mockImplementation(async () => {
        return storedValue;
      });

      mockCacheManager.del.mockResolvedValue(undefined);

      const result = await service.healthCheck();

      expect(result.status).toBe('healthy');
      expect(result.details.canWrite).toBe(true);
      expect(result.details.canRead).toBe(true);
    });

    it('should return unhealthy status when cache operations fail', async () => {
      // Reset all mocks first
      jest.clearAllMocks();
      
      // Make set operation fail, which should trigger the catch block
      mockCacheManager.set.mockRejectedValue(new Error('Cache unavailable'));

      const result = await service.healthCheck();

      expect(result.status).toBe('unhealthy');
      // The service should detect the failure and return unhealthy status
      expect(result.details).toBeDefined();
    });
  });

  describe('invalidateUserLibraryCache', () => {
    it('should invalidate only library-related cache entries', async () => {
      const userId = 'user123';
      const allKeys = [
        'library_user123_page1',
        'search_user123_query',
        'ownership_user123_game1',
        'user_profile_user123',
        'other_key_user123'
      ];

      mockCacheManager.get.mockResolvedValue(allKeys);

      await service.invalidateUserLibraryCache(userId);

      // Should delete library, search, and ownership keys
      expect(mockCacheManager.del).toHaveBeenCalledWith('library_user123_page1');
      expect(mockCacheManager.del).toHaveBeenCalledWith('search_user123_query');
      expect(mockCacheManager.del).toHaveBeenCalledWith('ownership_user123_game1');

      // Should update tracking key with remaining keys
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        `user-cache-keys:${userId}`,
        ['user_profile_user123', 'other_key_user123'],
        0
      );
    });

    it('should delete tracking key when no keys remain', async () => {
      const userId = 'user123';
      const allKeys = ['library_user123_page1', 'search_user123_query'];

      mockCacheManager.get.mockResolvedValue(allKeys);

      await service.invalidateUserLibraryCache(userId);

      expect(mockCacheManager.del).toHaveBeenCalledWith('library_user123_page1');
      expect(mockCacheManager.del).toHaveBeenCalledWith('search_user123_query');
      expect(mockCacheManager.del).toHaveBeenCalledWith(`user-cache-keys:${userId}`);
    });
  });

  describe('cacheLibraryData', () => {
    it('should cache library data with default TTL and record user key', async () => {
      const userId = 'user123';
      const cacheKey = 'library_user123_page1';
      const data = { games: [], pagination: {} };

      await service.cacheLibraryData(userId, cacheKey, data);

      expect(mockCacheManager.set).toHaveBeenCalledWith(cacheKey, data, 300);
      expect(mockCacheManager.get).toHaveBeenCalledWith(`user-cache-keys:${userId}`);
    });

    it('should cache library data with custom TTL', async () => {
      const userId = 'user123';
      const cacheKey = 'library_user123_page1';
      const data = { games: [], pagination: {} };
      const customTtl = 600;

      await service.cacheLibraryData(userId, cacheKey, data, customTtl);

      expect(mockCacheManager.set).toHaveBeenCalledWith(cacheKey, data, customTtl);
    });
  });

  describe('cacheSearchResults', () => {
    it('should cache search results with default TTL and record user key', async () => {
      const userId = 'user123';
      const cacheKey = 'search_user123_query';
      const results = { games: [], pagination: {} };

      await service.cacheSearchResults(userId, cacheKey, results);

      expect(mockCacheManager.set).toHaveBeenCalledWith(cacheKey, results, 300);
      expect(mockCacheManager.get).toHaveBeenCalledWith(`user-cache-keys:${userId}`);
    });
  });

  describe('getCachedLibraryData', () => {
    it('should return cached data if available', async () => {
      const userId = 'user123';
      const cacheKey = 'library_user123_page1';
      const cachedData = { games: [], pagination: {} };
      const fallbackFn = jest.fn();

      mockCacheManager.get.mockResolvedValue(cachedData);

      const result = await service.getCachedLibraryData(userId, cacheKey, fallbackFn);

      expect(result).toEqual(cachedData);
      expect(fallbackFn).not.toHaveBeenCalled();
      expect(mockCacheManager.get).toHaveBeenCalledWith(`user-cache-keys:${userId}`);
    });

    it('should execute fallback function if data not cached', async () => {
      const userId = 'user123';
      const cacheKey = 'library_user123_page1';
      const newData = { games: [], pagination: {} };
      const fallbackFn = jest.fn().mockResolvedValue(newData);

      mockCacheManager.get
        .mockResolvedValueOnce(undefined) // Cache miss
        .mockResolvedValueOnce(undefined); // User cache keys

      const result = await service.getCachedLibraryData(userId, cacheKey, fallbackFn);

      expect(result).toEqual(newData);
      expect(fallbackFn).toHaveBeenCalledTimes(1);
      expect(mockCacheManager.set).toHaveBeenCalledWith(cacheKey, newData, 300);
    });
  });

  describe('getCachedSearchResults', () => {
    it('should return cached search results if available', async () => {
      const userId = 'user123';
      const cacheKey = 'search_user123_query';
      const cachedResults = { games: [], pagination: {} };
      const fallbackFn = jest.fn();

      mockCacheManager.get.mockResolvedValue(cachedResults);

      const result = await service.getCachedSearchResults(userId, cacheKey, fallbackFn);

      expect(result).toEqual(cachedResults);
      expect(fallbackFn).not.toHaveBeenCalled();
    });
  });

  describe('invalidateGameCache', () => {
    it('should delete game details cache', async () => {
      const gameId = 'game123';

      await service.invalidateGameCache(gameId);

      expect(mockCacheManager.del).toHaveBeenCalledWith(`game_details_${gameId}`);
    });
  });
});
