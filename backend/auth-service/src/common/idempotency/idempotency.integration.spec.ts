import { IdempotencyService } from './idempotency.service';
import { RedisService } from '../redis/redis.service';

describe('Idempotency Integration Tests', () => {
  let idempotencyService: IdempotencyService;
  let redisService: RedisService;
  let configService: any;
  
  // Mock request object used across all tests
  const mockRequest = {
    method: 'POST',
    url: '/auth/register',
    body: {
      name: 'Test User',
      email: 'test@example.com',
      password: 'SecurePass123!',
    },
    userId: 'user-123',
  };

  beforeAll(async () => {
    // Create mock services for testing
    configService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config = {
          IDEMPOTENCY_TTL_SECONDS: 86400,
        };
        return config[key] || defaultValue;
      }),
    };

    redisService = {
      keys: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(1),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      getTTL: jest.fn().mockResolvedValue(3600),
    } as any;
    
    idempotencyService = new IdempotencyService(redisService, configService);
  });

  afterAll(async () => {
    // No cleanup needed for unit test
  });

  beforeEach(async () => {
    // Reset mocks before each test
    jest.clearAllMocks();
    (redisService.keys as jest.Mock).mockResolvedValue([]);
    (redisService.get as jest.Mock).mockResolvedValue(null);
    (redisService.set as jest.Mock).mockResolvedValue('OK');
    (redisService.delete as jest.Mock).mockResolvedValue(1);
    (redisService.getTTL as jest.Mock).mockResolvedValue(3600);
  });

  describe('IdempotencyService functionality', () => {
    it('should store and retrieve idempotency results', async () => {
      const idempotencyKey = 'test-register-001';
      const mockResult = {
        statusCode: 201,
        data: { user: { id: '123', email: 'test@example.com' }, access_token: 'token123' },
        timestamp: new Date(),
      };

      // Store result
      await idempotencyService.storeResult(idempotencyKey, mockRequest, mockResult);
      
      // Verify Redis set was called
      expect(redisService.set).toHaveBeenCalledWith(
        expect.stringContaining('auth-service:idempotency:'),
        expect.stringContaining('"statusCode":201'),
        86400
      );

      // Mock Redis to return stored data
      (redisService.get as jest.Mock).mockResolvedValue(JSON.stringify({
        ...mockResult,
        timestamp: mockResult.timestamp.toISOString(),
      }));

      // Retrieve result
      const retrievedResult = await idempotencyService.getResult(idempotencyKey, mockRequest);
      
      expect(retrievedResult).toBeDefined();
      expect(retrievedResult?.statusCode).toBe(201);
      expect(retrievedResult?.data.user.email).toBe('test@example.com');
    });

    it('should return null when no cached result exists', async () => {
      const idempotencyKey = 'test-register-002';

      // Mock Redis to return null (no cached result)
      (redisService.get as jest.Mock).mockResolvedValue(null);

      const result = await idempotencyService.getResult(idempotencyKey, mockRequest);
      
      expect(result).toBeNull();
      expect(redisService.get).toHaveBeenCalledWith(expect.stringContaining('auth-service:idempotency:'));
    });

    it('should handle operation progress tracking', async () => {
      const idempotencyKey = 'test-register-003';

      // Check if operation is in progress (should be false initially)
      (redisService.get as jest.Mock).mockResolvedValue(null);
      const isInProgress = await idempotencyService.isOperationInProgress(idempotencyKey, mockRequest);
      expect(isInProgress).toBe(false);

      // Mark operation as in progress
      await idempotencyService.markOperationInProgress(idempotencyKey, mockRequest);
      expect(redisService.set).toHaveBeenCalledWith(
        expect.stringContaining(':progress'),
        'true',
        300
      );

      // Clear operation progress
      await idempotencyService.clearOperationProgress(idempotencyKey, mockRequest);
      expect(redisService.delete).toHaveBeenCalledWith(expect.stringContaining(':progress'));
    });

    it('should store and retrieve error responses', async () => {
      const idempotencyKey = 'test-register-error-001';
      const errorResult = {
        statusCode: 400,
        data: { message: 'Invalid email format', errors: ['email must be valid'] },
        timestamp: new Date(),
      };

      // Store error result
      await idempotencyService.storeResult(idempotencyKey, mockRequest, errorResult);
      
      // Verify Redis set was called with error data
      expect(redisService.set).toHaveBeenCalledWith(
        expect.stringContaining('auth-service:idempotency:'),
        expect.stringContaining('"statusCode":400'),
        86400
      );

      // Mock Redis to return stored error
      (redisService.get as jest.Mock).mockResolvedValue(JSON.stringify({
        ...errorResult,
        timestamp: errorResult.timestamp.toISOString(),
      }));

      // Retrieve error result
      const retrievedResult = await idempotencyService.getResult(idempotencyKey, mockRequest);
      
      expect(retrievedResult).toBeDefined();
      expect(retrievedResult?.statusCode).toBe(400);
      expect(retrievedResult?.data.message).toBe('Invalid email format');
    });

    it('should delete idempotency results', async () => {
      const idempotencyKey = 'test-delete-001';

      await idempotencyService.deleteResult(idempotencyKey, mockRequest);
      
      // Should delete both main key and progress key
      expect(redisService.delete).toHaveBeenCalledTimes(2);
      expect(redisService.delete).toHaveBeenCalledWith(expect.stringContaining('auth-service:idempotency:'));
      expect(redisService.delete).toHaveBeenCalledWith(expect.stringContaining(':progress'));
    });
  });

  describe('Idempotency TTL and cleanup', () => {
    it('should respect TTL configuration', async () => {
      const idempotencyKey = 'test-ttl-001';
      const mockResult = {
        statusCode: 201,
        data: { user: { id: '123' } },
        timestamp: new Date(),
      };

      await idempotencyService.storeResult(idempotencyKey, mockRequest, mockResult);
      
      // Verify TTL is set to configured value (86400 seconds = 24 hours)
      expect(redisService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        86400
      );
    });
  });

  describe('Idempotency statistics', () => {
    it('should provide accurate statistics', async () => {
      // Mock Redis keys response
      const mockKeys = [
        'auth-service:idempotency:key1',
        'auth-service:idempotency:key2',
        'auth-service:idempotency:key3',
        'auth-service:idempotency:key1:progress',
      ];
      (redisService.keys as jest.Mock).mockResolvedValue(mockKeys);

      // Mock Redis get for sample keys
      (redisService.get as jest.Mock).mockResolvedValue(JSON.stringify({
        timestamp: new Date().toISOString(),
        statusCode: 201,
        data: {},
      }));

      const stats = await idempotencyService.getStats();
      
      expect(stats.totalKeys).toBe(3); // 3 result keys (excluding progress keys)
      expect(stats.progressKeys).toBe(1); // 1 progress key
      expect(stats.oldestEntry).toBeDefined();
      expect(stats.newestEntry).toBeDefined();
    });

    it('should handle empty statistics', async () => {
      // Mock empty Redis response
      (redisService.keys as jest.Mock).mockResolvedValue([]);

      const stats = await idempotencyService.getStats();
      
      expect(stats.totalKeys).toBe(0);
      expect(stats.progressKeys).toBe(0);
      expect(stats.oldestEntry).toBeUndefined();
      expect(stats.newestEntry).toBeUndefined();
    });
  });
});