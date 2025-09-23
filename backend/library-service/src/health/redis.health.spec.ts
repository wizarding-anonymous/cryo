import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HealthCheckError } from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis.health';

describe('RedisHealthIndicator', () => {
  let healthIndicator: RedisHealthIndicator;
  let cacheManager: any;

  const mockCacheManager = {
    set: jest.fn(),
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisHealthIndicator,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    healthIndicator = module.get<RedisHealthIndicator>(RedisHealthIndicator);
    cacheManager = module.get(CACHE_MANAGER);
    jest.clearAllMocks();
  });

  describe('isHealthy', () => {
    it('should return healthy status when Redis is working', async () => {
      mockCacheManager.set.mockResolvedValue(undefined);
      mockCacheManager.get.mockResolvedValue('ok');

      const result = await healthIndicator.isHealthy('redis');

      expect(result).toEqual({
        redis: {
          status: 'up',
        },
      });
      expect(mockCacheManager.set).toHaveBeenCalledWith('health-check', 'ok', 10);
      expect(mockCacheManager.get).toHaveBeenCalledWith('health-check');
    });

    it('should throw HealthCheckError when Redis set operation fails', async () => {
      const error = new Error('Redis connection failed');
      mockCacheManager.set.mockRejectedValue(error);

      await expect(healthIndicator.isHealthy('redis')).rejects.toThrow(
        HealthCheckError,
      );

      expect(mockCacheManager.set).toHaveBeenCalledWith('health-check', 'ok', 10);
    });

    it('should throw HealthCheckError when Redis get operation fails', async () => {
      mockCacheManager.set.mockResolvedValue(undefined);
      const error = new Error('Redis get failed');
      mockCacheManager.get.mockRejectedValue(error);

      await expect(healthIndicator.isHealthy('redis')).rejects.toThrow(
        HealthCheckError,
      );

      expect(mockCacheManager.set).toHaveBeenCalledWith('health-check', 'ok', 10);
      expect(mockCacheManager.get).toHaveBeenCalledWith('health-check');
    });

    it('should throw HealthCheckError when health check value is incorrect', async () => {
      mockCacheManager.set.mockResolvedValue(undefined);
      mockCacheManager.get.mockResolvedValue('not-ok');

      await expect(healthIndicator.isHealthy('redis')).rejects.toThrow(
        HealthCheckError,
      );

      expect(mockCacheManager.set).toHaveBeenCalledWith('health-check', 'ok', 10);
      expect(mockCacheManager.get).toHaveBeenCalledWith('health-check');
    });

    it('should handle unknown error types', async () => {
      mockCacheManager.set.mockRejectedValue('string error');

      await expect(healthIndicator.isHealthy('redis')).rejects.toThrow(
        HealthCheckError,
      );
    });

    it('should include error message in HealthCheckError', async () => {
      const error = new Error('Specific Redis error');
      mockCacheManager.set.mockRejectedValue(error);

      try {
        await healthIndicator.isHealthy('redis');
      } catch (e: unknown) {
        expect(e).toBeInstanceOf(HealthCheckError);
        const healthError = e as HealthCheckError;
        expect(healthError.message).toBe('RedisHealthIndicator failed');
        expect(healthError.causes).toEqual({
          redis: {
            status: 'down',
            message: 'Specific Redis error',
          },
        });
      }
    });
  });
});