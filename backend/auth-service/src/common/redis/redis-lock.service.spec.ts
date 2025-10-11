import { Test, TestingModule } from '@nestjs/testing';
import { RedisLockService } from './redis-lock.service';
import { RedisService } from './redis.service';

describe('RedisLockService', () => {
  let service: RedisLockService;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(async () => {
    const mockRedisService = {
      setNX: jest.fn(),
      delete: jest.fn(),
      get: jest.fn(),
      getTTL: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisLockService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<RedisLockService>(RedisLockService);
    redisService = module.get(RedisService);
  });

  describe('acquireLock', () => {
    it('should acquire lock successfully', async () => {
      // Arrange
      redisService.setNX.mockResolvedValue('OK');

      // Act
      const result = await service.acquireLock('test-key');

      // Assert
      expect(result).toBe(true);
      expect(redisService.setNX).toHaveBeenCalledWith(
        'auth-service:lock:test-key',
        expect.any(String),
        5
      );
    });

    it('should fail to acquire lock when already exists', async () => {
      // Arrange
      redisService.setNX.mockResolvedValue(null);

      // Act
      const result = await service.acquireLock('test-key');

      // Assert
      expect(result).toBe(false);
    });

    it('should retry lock acquisition with custom options', async () => {
      // Arrange
      redisService.setNX
        .mockResolvedValueOnce(null) // First attempt fails
        .mockResolvedValueOnce('OK'); // Second attempt succeeds

      // Act
      const result = await service.acquireLock('test-key', {
        maxRetries: 1,
        retryDelayMs: 10,
        ttlSeconds: 10
      });

      // Assert
      expect(result).toBe(true);
      expect(redisService.setNX).toHaveBeenCalledTimes(2);
    });

    it('should handle Redis errors gracefully', async () => {
      // Arrange
      redisService.setNX.mockRejectedValue(new Error('Redis connection failed'));

      // Act
      const result = await service.acquireLock('test-key');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('releaseLock', () => {
    it('should release lock successfully', async () => {
      // Arrange
      redisService.delete.mockResolvedValue();

      // Act
      await service.releaseLock('test-key');

      // Assert
      expect(redisService.delete).toHaveBeenCalledWith('auth-service:lock:test-key');
    });

    it('should handle release errors gracefully', async () => {
      // Arrange
      redisService.delete.mockRejectedValue(new Error('Redis error'));

      // Act & Assert - Should not throw
      await expect(service.releaseLock('test-key')).resolves.toBeUndefined();
    });
  });

  describe('withLock', () => {
    it('should execute function with lock protection', async () => {
      // Arrange
      redisService.setNX.mockResolvedValue('OK');
      redisService.delete.mockResolvedValue();
      const mockFunction = jest.fn().mockResolvedValue('test-result');

      // Act
      const result = await service.withLock('test-key', mockFunction);

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
      await expect(service.withLock('test-key', mockFunction)).rejects.toThrow('Function error');
      expect(redisService.delete).toHaveBeenCalled();
    });

    it('should throw error if lock cannot be acquired', async () => {
      // Arrange
      redisService.setNX.mockResolvedValue(null);
      const mockFunction = jest.fn();

      // Act & Assert
      await expect(service.withLock('test-key', mockFunction)).rejects.toThrow('Failed to acquire lock: test-key');
      expect(mockFunction).not.toHaveBeenCalled();
    });
  });

  describe('isLocked', () => {
    it('should return true when lock exists', async () => {
      // Arrange
      redisService.get.mockResolvedValue('lock-value');

      // Act
      const result = await service.isLocked('test-key');

      // Assert
      expect(result).toBe(true);
      expect(redisService.get).toHaveBeenCalledWith('auth-service:lock:test-key');
    });

    it('should return false when lock does not exist', async () => {
      // Arrange
      redisService.get.mockResolvedValue(null);

      // Act
      const result = await service.isLocked('test-key');

      // Assert
      expect(result).toBe(false);
    });

    it('should return false on Redis error', async () => {
      // Arrange
      redisService.get.mockRejectedValue(new Error('Redis error'));

      // Act
      const result = await service.isLocked('test-key');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('concurrent lock scenarios', () => {
    it('should handle race condition between multiple lock attempts', async () => {
      // Arrange - Simulate race condition
      let lockAttempts = 0;
      redisService.setNX.mockImplementation(() => {
        lockAttempts++;
        if (lockAttempts === 1) {
          return Promise.resolve('OK'); // First attempt succeeds
        }
        return Promise.resolve(null); // Subsequent attempts fail
      });

      // Act - Multiple concurrent lock attempts
      const promises = [
        service.acquireLock('session_limit:user-123'),
        service.acquireLock('session_limit:user-123'),
        service.acquireLock('session_limit:user-123'),
      ];

      const results = await Promise.all(promises);

      // Assert - Only one should succeed
      const successCount = results.filter(result => result === true).length;
      expect(successCount).toBe(1);
      expect(redisService.setNX).toHaveBeenCalledTimes(3);
    });
  });

  describe('lock key prefixing', () => {
    it('should use service-specific prefix for lock keys', async () => {
      // Arrange
      redisService.setNX.mockResolvedValue('OK');

      // Act
      await service.acquireLock('session_limit:user-123');

      // Assert
      expect(redisService.setNX).toHaveBeenCalledWith(
        'auth-service:lock:session_limit:user-123',
        expect.any(String),
        5
      );
    });

    it('should use prefixed key for all operations', async () => {
      // Arrange
      redisService.get.mockResolvedValue('value');
      redisService.getTTL.mockResolvedValue(30);
      redisService.delete.mockResolvedValue();

      // Act
      await service.isLocked('test-key');
      await service.getLockTTL('test-key');
      await service.releaseLock('test-key');

      // Assert
      expect(redisService.get).toHaveBeenCalledWith('auth-service:lock:test-key');
      expect(redisService.getTTL).toHaveBeenCalledWith('auth-service:lock:test-key');
      expect(redisService.delete).toHaveBeenCalledWith('auth-service:lock:test-key');
    });
  });
});