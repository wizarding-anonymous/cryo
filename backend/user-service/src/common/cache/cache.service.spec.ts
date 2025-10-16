import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';
import { CacheMetrics } from './cache.metrics';
import { RedisService } from '../redis/redis.service';
import { MetricsService } from '../metrics/metrics.service';

describe('CacheService', () => {
  let service: CacheService;
  let redisService: RedisService;
  let metrics: CacheMetrics;

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    getClient: jest.fn(() => ({
      mget: jest.fn(),
      pipeline: jest.fn(() => ({
        setex: jest.fn(),
        exec: jest.fn(),
      })),
      keys: jest.fn(),
      del: jest.fn(),
      info: jest.fn(),
    })),
    healthCheck: jest.fn(),
  };

  const mockMetrics = {
    recordCacheHit: jest.fn(),
    recordCacheMiss: jest.fn(),
    recordCacheOperationDuration: jest.fn(),
    updateCacheHitRatio: jest.fn(),
    recordBatchOperation: jest.fn(),
  };

  const mockMetricsService = {
    incrementCounter: jest.fn(),
    recordHistogram: jest.fn(),
    setGauge: jest.fn(),
    getMetrics: jest.fn(),
    recordCacheOperation: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: CacheMetrics,
          useValue: mockMetrics,
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    redisService = module.get<RedisService>(RedisService);
    metrics = module.get<CacheMetrics>(CacheMetrics);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUser', () => {
    it('should return cached user when found', async () => {
      const userId = 'test-user-id';
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
      };

      mockRedisService.get.mockResolvedValue(mockUser);

      const result = await service.getUser(userId);

      expect(result).toEqual(mockUser);
      expect(mockRedisService.get).toHaveBeenCalledWith(
        'user-service:user:test-user-id',
      );
      expect(mockMetrics.recordCacheHit).toHaveBeenCalledWith('user', 'get');
    });

    it('should return null when user not found in cache', async () => {
      const userId = 'test-user-id';

      mockRedisService.get.mockResolvedValue(null);

      const result = await service.getUser(userId);

      expect(result).toBeNull();
      expect(mockRedisService.get).toHaveBeenCalledWith(
        'user-service:user:test-user-id',
      );
      expect(mockMetrics.recordCacheMiss).toHaveBeenCalledWith('user', 'get');
    });

    it('should handle redis errors gracefully', async () => {
      const userId = 'test-user-id';

      mockRedisService.get.mockRejectedValue(
        new Error('Redis connection failed'),
      );

      const result = await service.getUser(userId);

      expect(result).toBeNull();
      expect(mockMetrics.recordCacheMiss).toHaveBeenCalledWith('user', 'get');
    });
  });

  describe('setUser', () => {
    it('should cache user with default TTL', async () => {
      const mockUser = {
        id: 'test-id',
        email: 'test@example.com',
        name: 'Test User',
      };

      await service.setUser(mockUser as any);

      expect(mockRedisService.set).toHaveBeenCalledWith(
        'user-service:user:test-id',
        mockUser,
        300, // Default TTL
      );
    });

    it('should cache user with custom TTL', async () => {
      const mockUser = {
        id: 'test-id',
        email: 'test@example.com',
        name: 'Test User',
      };
      const customTtl = 600;

      await service.setUser(mockUser as any, customTtl);

      expect(mockRedisService.set).toHaveBeenCalledWith(
        'user-service:user:test-id',
        mockUser,
        customTtl,
      );
    });
  });

  describe('invalidateUser', () => {
    it('should invalidate both user and profile cache', async () => {
      const userId = 'test-user-id';

      await service.invalidateUser(userId);

      expect(mockRedisService.del).toHaveBeenCalledTimes(2);
      expect(mockRedisService.del).toHaveBeenCalledWith(
        'user-service:user:test-user-id',
      );
      expect(mockRedisService.del).toHaveBeenCalledWith(
        'user-service:profile:test-user-id',
      );
    });
  });

  describe('getUsersBatch', () => {
    it('should return empty map for empty input', async () => {
      const result = await service.getUsersBatch([]);

      expect(result.size).toBe(0);
      expect(mockRedisService.getClient).not.toHaveBeenCalled();
    });

    it('should handle batch retrieval successfully', async () => {
      const userIds = ['user1', 'user2', 'user3'];
      const mockUsers = [
        JSON.stringify({ id: 'user1', name: 'User 1' }),
        null, // user2 not in cache
        JSON.stringify({ id: 'user3', name: 'User 3' }),
      ];

      const mockClient = {
        mget: jest.fn().mockResolvedValue(mockUsers),
        pipeline: jest.fn(() => ({
          setex: jest.fn(),
          exec: jest.fn(),
        })),
        keys: jest.fn(),
        del: jest.fn(),
        info: jest.fn(),
      };
      mockRedisService.getClient.mockReturnValue(mockClient);

      const result = await service.getUsersBatch(userIds);

      expect(result.size).toBe(2);
      expect(result.has('user1')).toBe(true);
      expect(result.has('user2')).toBe(false);
      expect(result.has('user3')).toBe(true);
      expect(mockMetrics.recordBatchOperation).toHaveBeenCalledWith(
        'getUsersBatch',
        'success',
        3,
        expect.any(Number),
      );
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      // Simulate some cache operations to generate stats
      service['stats'] = {
        hits: 80,
        misses: 20,
        totalLatency: 1000,
        operations: 100,
      };

      const stats = await service.getCacheStats();

      expect(stats).toEqual({
        hits: 80,
        misses: 20,
        hitRatio: 80,
        totalOperations: 100,
        averageLatency: 10,
      });
    });
  });

  describe('healthCheck', () => {
    it('should return redis health status', async () => {
      mockRedisService.healthCheck.mockResolvedValue(true);

      const result = await service.healthCheck();

      expect(result).toBe(true);
      expect(mockRedisService.healthCheck).toHaveBeenCalled();
    });

    it('should handle health check errors', async () => {
      mockRedisService.healthCheck.mockRejectedValue(
        new Error('Health check failed'),
      );

      const result = await service.healthCheck();

      expect(result).toBe(false);
    });
  });
});
