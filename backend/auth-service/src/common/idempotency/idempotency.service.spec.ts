import { ConfigService } from '@nestjs/config';
import { IdempotencyService, IdempotencyRequest, IdempotencyResult } from './idempotency.service';
import { RedisService } from '../redis/redis.service';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let redisService: jest.Mocked<RedisService>;
  let configService: jest.Mocked<ConfigService>;

  const mockIdempotencyRequest: IdempotencyRequest = {
    method: 'POST',
    url: '/auth/register',
    body: { email: 'test@example.com', password: 'password123' },
    userId: 'user-123',
  };

  const mockIdempotencyResult: IdempotencyResult = {
    statusCode: 201,
    data: { user: { id: 'user-123' }, access_token: 'token123' },
    timestamp: new Date('2024-01-15T10:30:00.000Z'),
    headers: { 'content-type': 'application/json' },
  };

  beforeEach(() => {
    redisService = {
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
      keys: jest.fn(),
      getTTL: jest.fn(),
    } as any;

    configService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'IDEMPOTENCY_TTL_SECONDS') return 86400;
        return defaultValue;
      }),
    } as any;

    service = new IdempotencyService(redisService, configService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('storeResult', () => {
    it('should store idempotency result in Redis', async () => {
      const idempotencyKey = 'test-key-123';

      await service.storeResult(idempotencyKey, mockIdempotencyRequest, mockIdempotencyResult);

      expect(redisService.set).toHaveBeenCalledWith(
        expect.stringContaining('idempotency:'),
        expect.stringContaining('"statusCode":201'),
        86400,
      );
    });

    it('should handle Redis errors gracefully', async () => {
      const idempotencyKey = 'test-key-123';
      redisService.set.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(
        service.storeResult(idempotencyKey, mockIdempotencyRequest, mockIdempotencyResult)
      ).resolves.toBeUndefined();
    });

    it('should use custom TTL from config', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'IDEMPOTENCY_TTL_SECONDS') return 3600;
        return defaultValue;
      });

      // Recreate service with new config
      service = new IdempotencyService(redisService, configService);

      const idempotencyKey = 'test-key-123';
      await service.storeResult(idempotencyKey, mockIdempotencyRequest, mockIdempotencyResult);

      expect(redisService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        3600,
      );
    });
  });

  describe('getResult', () => {
    it('should retrieve stored idempotency result', async () => {
      const idempotencyKey = 'test-key-123';
      const storedData = JSON.stringify({
        ...mockIdempotencyResult,
        timestamp: mockIdempotencyResult.timestamp.toISOString(),
        request: {
          method: mockIdempotencyRequest.method,
          url: mockIdempotencyRequest.url,
          userId: mockIdempotencyRequest.userId,
        },
      });

      redisService.get.mockResolvedValue(storedData);

      const result = await service.getResult(idempotencyKey, mockIdempotencyRequest);

      expect(result).toEqual(expect.objectContaining({
        statusCode: mockIdempotencyResult.statusCode,
        data: mockIdempotencyResult.data,
        timestamp: mockIdempotencyResult.timestamp,
        headers: mockIdempotencyResult.headers,
      }));
      expect(redisService.get).toHaveBeenCalledWith(expect.stringContaining('idempotency:'));
    });

    it('should return null when no result is stored', async () => {
      const idempotencyKey = 'test-key-123';
      redisService.get.mockResolvedValue(null);

      const result = await service.getResult(idempotencyKey, mockIdempotencyRequest);

      expect(result).toBeNull();
    });

    it('should handle Redis errors gracefully', async () => {
      const idempotencyKey = 'test-key-123';
      redisService.get.mockRejectedValue(new Error('Redis error'));

      const result = await service.getResult(idempotencyKey, mockIdempotencyRequest);

      expect(result).toBeNull();
    });

    it('should handle invalid JSON gracefully', async () => {
      const idempotencyKey = 'test-key-123';
      redisService.get.mockResolvedValue('invalid-json');

      const result = await service.getResult(idempotencyKey, mockIdempotencyRequest);

      expect(result).toBeNull();
    });
  });

  describe('isOperationInProgress', () => {
    it('should return true when operation is in progress', async () => {
      const idempotencyKey = 'test-key-123';
      redisService.get.mockResolvedValue('true');

      const result = await service.isOperationInProgress(idempotencyKey, mockIdempotencyRequest);

      expect(result).toBe(true);
      expect(redisService.get).toHaveBeenCalledWith(expect.stringContaining(':progress'));
    });

    it('should return false when operation is not in progress', async () => {
      const idempotencyKey = 'test-key-123';
      redisService.get.mockResolvedValue(null);

      const result = await service.isOperationInProgress(idempotencyKey, mockIdempotencyRequest);

      expect(result).toBe(false);
    });

    it('should handle Redis errors gracefully', async () => {
      const idempotencyKey = 'test-key-123';
      redisService.get.mockRejectedValue(new Error('Redis error'));

      const result = await service.isOperationInProgress(idempotencyKey, mockIdempotencyRequest);

      expect(result).toBe(false);
    });
  });

  describe('markOperationInProgress', () => {
    it('should mark operation as in progress', async () => {
      const idempotencyKey = 'test-key-123';

      await service.markOperationInProgress(idempotencyKey, mockIdempotencyRequest);

      expect(redisService.set).toHaveBeenCalledWith(
        expect.stringContaining(':progress'),
        'true',
        300, // 5 minutes
      );
    });

    it('should handle Redis errors gracefully', async () => {
      const idempotencyKey = 'test-key-123';
      redisService.set.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(
        service.markOperationInProgress(idempotencyKey, mockIdempotencyRequest)
      ).resolves.toBeUndefined();
    });
  });

  describe('clearOperationProgress', () => {
    it('should clear operation progress marker', async () => {
      const idempotencyKey = 'test-key-123';

      await service.clearOperationProgress(idempotencyKey, mockIdempotencyRequest);

      expect(redisService.delete).toHaveBeenCalledWith(expect.stringContaining(':progress'));
    });

    it('should handle Redis errors gracefully', async () => {
      const idempotencyKey = 'test-key-123';
      redisService.delete.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(
        service.clearOperationProgress(idempotencyKey, mockIdempotencyRequest)
      ).resolves.toBeUndefined();
    });
  });

  describe('deleteResult', () => {
    it('should delete both result and progress keys', async () => {
      const idempotencyKey = 'test-key-123';

      await service.deleteResult(idempotencyKey, mockIdempotencyRequest);

      expect(redisService.delete).toHaveBeenCalledTimes(2);
      expect(redisService.delete).toHaveBeenCalledWith(expect.stringContaining('idempotency:'));
      expect(redisService.delete).toHaveBeenCalledWith(expect.stringContaining(':progress'));
    });
  });

  describe('getStats', () => {
    it('should return idempotency statistics', async () => {
      const mockKeys = [
        'idempotency:key1',
        'idempotency:key2',
        'idempotency:key3:progress',
        'idempotency:key4:progress',
      ];

      redisService.keys.mockResolvedValue(mockKeys);
      redisService.get.mockResolvedValue(JSON.stringify({
        timestamp: '2024-01-15T10:30:00.000Z',
      }));

      const stats = await service.getStats();

      expect(stats.totalKeys).toBe(2); // Excluding progress keys
      expect(stats.progressKeys).toBe(2);
      expect(stats.oldestEntry).toBeInstanceOf(Date);
      expect(stats.newestEntry).toBeInstanceOf(Date);
    });

    it('should handle empty results', async () => {
      redisService.keys.mockResolvedValue([]);

      const stats = await service.getStats();

      expect(stats.totalKeys).toBe(0);
      expect(stats.progressKeys).toBe(0);
      expect(stats.oldestEntry).toBeUndefined();
      expect(stats.newestEntry).toBeUndefined();
    });
  });

  describe('key generation', () => {
    it('should generate consistent keys for same request', async () => {
      const idempotencyKey = 'test-key-123';

      // Store and retrieve to test key consistency
      await service.storeResult(idempotencyKey, mockIdempotencyRequest, mockIdempotencyResult);

      const storedData = JSON.stringify({
        ...mockIdempotencyResult,
        timestamp: mockIdempotencyResult.timestamp.toISOString(),
        request: {
          method: mockIdempotencyRequest.method,
          url: mockIdempotencyRequest.url,
          userId: mockIdempotencyRequest.userId,
        },
      });
      redisService.get.mockResolvedValue(storedData);

      const result = await service.getResult(idempotencyKey, mockIdempotencyRequest);

      expect(result).toEqual(expect.objectContaining({
        statusCode: mockIdempotencyResult.statusCode,
        data: mockIdempotencyResult.data,
        timestamp: mockIdempotencyResult.timestamp,
        headers: mockIdempotencyResult.headers,
      }));
    });

    it('should generate different keys for different requests', async () => {
      const idempotencyKey1 = 'test-key-123';
      const idempotencyKey2 = 'test-key-456';
      const differentRequest = {
        ...mockIdempotencyRequest,
        body: { email: 'different@example.com' },
      };

      await service.storeResult(idempotencyKey1, mockIdempotencyRequest, mockIdempotencyResult);
      await service.storeResult(idempotencyKey2, differentRequest, mockIdempotencyResult);

      // Should have been called twice with different keys
      expect(redisService.set).toHaveBeenCalledTimes(2);
      const calls = redisService.set.mock.calls;
      expect(calls[0][0]).not.toBe(calls[1][0]);
    });
  });
});