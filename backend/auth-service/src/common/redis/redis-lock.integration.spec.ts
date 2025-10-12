import { RedisLockService } from './redis-lock.service';
import { RedisService } from './redis.service';
import { RaceConditionMetricsService } from '../metrics/race-condition-metrics.service';
import { ConfigService } from '@nestjs/config';

describe('RedisLockService - Integration Tests (Mocked)', () => {
  let redisLockService: RedisLockService;
  let redisService: jest.Mocked<RedisService>;
  let metricsService: RaceConditionMetricsService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    redisService = {
      onModuleInit: jest.fn(),
      onModuleDestroy: jest.fn(),
      setNX: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
      set: jest.fn(),
      getTTL: jest.fn(),
    } as any;

    configService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          REDIS_HOST: 'localhost',
          REDIS_PORT: '6379',
          REDIS_URL: 'redis://:redis_password@localhost:6379',
          REDIS_PASSWORD: 'redis_password',
        };
        return config[key] || defaultValue;
      }),
    } as any;

    metricsService = new RaceConditionMetricsService();
    redisLockService = new RedisLockService(redisService, metricsService);
    
    // Reset metrics before each test
    metricsService.resetMetrics();
  });

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('Lock Acquisition and Release', () => {
    it('should acquire lock successfully when Redis returns OK', async () => {
      // Arrange
      redisService.setNX.mockResolvedValue('OK');

      // Act
      const acquired = await redisLockService.acquireLock('test-lock', { ttlSeconds: 5 });
      
      // Assert
      expect(acquired).toBe(true);
      expect(redisService.setNX).toHaveBeenCalledWith(
        'auth-service:lock:test-lock',
        expect.any(String),
        5
      );
    });

    it('should fail to acquire lock when Redis returns null', async () => {
      // Arrange
      redisService.setNX.mockResolvedValue(null);

      // Act
      const acquired = await redisLockService.acquireLock('test-lock', { ttlSeconds: 5 });
      
      // Assert
      expect(acquired).toBe(false);
    });

    it('should release lock successfully', async () => {
      // Arrange
      redisService.delete.mockResolvedValue();

      // Act
      await redisLockService.releaseLock('test-lock');
      
      // Assert
      expect(redisService.delete).toHaveBeenCalledWith('auth-service:lock:test-lock');
    });

    it('should check if lock exists', async () => {
      // Arrange
      redisService.get.mockResolvedValue('lock-value');

      // Act
      const isLocked = await redisLockService.isLocked('test-lock');
      
      // Assert
      expect(isLocked).toBe(true);
      expect(redisService.get).toHaveBeenCalledWith('auth-service:lock:test-lock');
    });
  });

  describe('WithLock Functionality', () => {
    it('should execute function with lock protection', async () => {
      // Arrange
      redisService.setNX.mockResolvedValue('OK');
      redisService.delete.mockResolvedValue();
      const mockFunction = jest.fn().mockResolvedValue('test-result');

      // Act
      const result = await redisLockService.withLock('test-key', mockFunction);

      // Assert
      expect(result).toBe('test-result');
      expect(mockFunction).toHaveBeenCalledTimes(1);
      expect(redisService.setNX).toHaveBeenCalled();
      expect(redisService.delete).toHaveBeenCalled();
    });

    it('should release lock even if function throws error', async () => {
      // Arrange
      redisService.setNX.mockResolvedValue('OK');
      redisService.delete.mockResolvedValue();
      const mockFunction = jest.fn().mockRejectedValue(new Error('Function error'));

      // Act & Assert
      await expect(redisLockService.withLock('test-key', mockFunction)).rejects.toThrow('Function error');
      expect(redisService.delete).toHaveBeenCalled();
    });

    it('should throw error if lock cannot be acquired', async () => {
      // Arrange
      redisService.setNX.mockResolvedValue(null);
      const mockFunction = jest.fn();

      // Act & Assert
      await expect(redisLockService.withLock('test-key', mockFunction)).rejects.toThrow('Failed to acquire lock: test-key');
      expect(mockFunction).not.toHaveBeenCalled();
    });

    it('should record metrics for lock attempts', async () => {
      // Arrange
      redisService.setNX.mockResolvedValue('OK');
      redisService.delete.mockResolvedValue();
      const mockFunction = jest.fn().mockResolvedValue('result');

      // Act
      await redisLockService.withLock('test-key', mockFunction);

      // Assert
      const metrics = metricsService.getMetrics();
      expect(metrics.totalLockAttempts).toBe(1);
      expect(metrics.successfulLockAcquisitions).toBe(1);
    });
  });

  describe('Lock Key Prefixing for Microservice Isolation', () => {
    it('should use service-specific prefix for lock keys', async () => {
      // Arrange
      redisService.setNX.mockResolvedValue('OK');
      const lockKey = 'session_limit:user-999';
      
      // Act
      await redisLockService.acquireLock(lockKey);
      
      // Assert - Verify that the prefixed key was used
      expect(redisService.setNX).toHaveBeenCalledWith(
        'auth-service:lock:session_limit:user-999',
        expect.any(String),
        5
      );
    });

    it('should check lock status with prefixed key', async () => {
      // Arrange
      redisService.get.mockResolvedValue('lock-value');
      const lockKey = 'shared-resource';
      
      // Act
      await redisLockService.isLocked(lockKey);
      
      // Assert
      expect(redisService.get).toHaveBeenCalledWith('auth-service:lock:shared-resource');
    });

    it('should release lock with prefixed key', async () => {
      // Arrange
      redisService.delete.mockResolvedValue();
      const lockKey = 'test-resource';
      
      // Act
      await redisLockService.releaseLock(lockKey);
      
      // Assert
      expect(redisService.delete).toHaveBeenCalledWith('auth-service:lock:test-resource');
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      // Arrange
      redisService.setNX.mockRejectedValue(new Error('Redis connection failed'));
      
      // Act
      const result = await redisLockService.acquireLock('test-key');
      
      // Assert
      expect(result).toBe(false);
    });

    it('should handle Redis errors during lock check', async () => {
      // Arrange
      redisService.get.mockRejectedValue(new Error('Redis error'));
      
      // Act
      const result = await redisLockService.isLocked('test-key');
      
      // Assert
      expect(result).toBe(false); // Should fail open
    });

    it('should handle Redis errors during lock release gracefully', async () => {
      // Arrange
      redisService.delete.mockRejectedValue(new Error('Redis error'));
      
      // Act & Assert - Should not throw
      await expect(redisLockService.releaseLock('test-key')).resolves.toBeUndefined();
    });

    it('should record failed lock attempts in metrics', async () => {
      // Arrange
      redisService.setNX.mockRejectedValue(new Error('Redis error'));
      
      // Act
      await redisLockService.acquireLock('test-key');
      
      // Assert
      const metrics = metricsService.getMetrics();
      expect(metrics.totalLockAttempts).toBe(1);
      expect(metrics.failedLockAcquisitions).toBe(1);
    });
  });

  describe('Retry Logic', () => {
    it('should retry lock acquisition when configured', async () => {
      // Arrange
      redisService.setNX
        .mockResolvedValueOnce(null) // First attempt fails
        .mockResolvedValueOnce('OK'); // Second attempt succeeds
      
      // Act
      const result = await redisLockService.acquireLock('test-key', {
        maxRetries: 1,
        retryDelayMs: 10,
      });
      
      // Assert
      expect(result).toBe(true);
      expect(redisService.setNX).toHaveBeenCalledTimes(2);
    });

    it('should record conflicts in metrics when retrying', async () => {
      // Arrange
      redisService.setNX
        .mockResolvedValueOnce(null) // First attempt fails (conflict)
        .mockResolvedValueOnce('OK'); // Second attempt succeeds
      
      // Act
      await redisLockService.acquireLock('test-key', {
        maxRetries: 1,
        retryDelayMs: 10,
      });
      
      // Assert
      const metrics = metricsService.getMetrics();
      expect(metrics.lockConflicts).toBe(1);
      expect(metrics.successfulLockAcquisitions).toBe(1);
    });
  });
});