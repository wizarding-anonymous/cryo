import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { ServiceUnavailableException } from '@nestjs/common';
import { UserServiceClient, CreateUserDto, User } from './user-service.client';
import { ServiceUnavailableError } from '../circuit-breaker/base-circuit-breaker.client';

describe('UserServiceClient', () => {
  let client: UserServiceClient;
  let httpService: jest.Mocked<HttpService>;
  let mockCircuitBreaker: any;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedPassword',
    isActive: true,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    // Create mock circuit breaker
    mockCircuitBreaker = {
      fire: jest.fn(),
      fallback: jest.fn(),
      opened: false,
      halfOpen: false,
      name: 'UserService',
    };

    const mockHttpService = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue('http://localhost:3002'),
    };

    const mockCircuitBreakerService = {
      createCircuitBreaker: jest.fn().mockReturnValue(mockCircuitBreaker),
      getCircuitBreakerStats: jest.fn().mockReturnValue({
        requests: 0,
        successes: 0,
        failures: 0,
        rejects: 0,
        timeouts: 0,
        fallbacks: 0,
        state: 'CLOSED'
      }),
    };

    const mockCircuitBreakerConfig = {
      getUserServiceConfig: jest.fn().mockReturnValue({
        timeout: 3000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        rollingCountTimeout: 10000,
        rollingCountBuckets: 10,
        volumeThreshold: 10,
        name: 'UserService',
      }),
    };

    const mockUserCacheService = {
      getCachedUserByEmail: jest.fn().mockResolvedValue(undefined),
      getCachedUserById: jest.fn().mockResolvedValue(undefined),
      setCachedUserByEmail: jest.fn().mockResolvedValue(undefined),
      setCachedUserById: jest.fn().mockResolvedValue(undefined),
      setCachedUser: jest.fn().mockResolvedValue(undefined),
      invalidateUser: jest.fn().mockResolvedValue(undefined),
      getExpiredCacheByEmail: jest.fn().mockResolvedValue(null),
      getExpiredCacheById: jest.fn().mockResolvedValue(null),
      clear: jest.fn().mockResolvedValue(undefined),
      getUserCacheStats: jest.fn().mockReturnValue({
        localSize: 0,
        maxSize: 10000,
        hitRatio: 0,
        missRatio: 0,
      }),
      getMetrics: jest.fn().mockReturnValue({
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
      }),
      getCacheInfo: jest.fn().mockReturnValue({
        isHealthy: true,
        memoryPressure: false,
        performance: true,
        uptime: 0,
        redisEnabled: false,
      }),
    };

    httpService = mockHttpService as any;
    
    client = new UserServiceClient(
      httpService,
      mockConfigService as any,
      mockCircuitBreakerService as any,
      mockCircuitBreakerConfig as any,
      mockUserCacheService as any
    );

    // Set up default circuit breaker behavior to resolve successfully
    mockCircuitBreaker.fire.mockImplementation(async () => {
      const response: AxiosResponse = {
        data: mockUser,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      return Promise.resolve(response);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    client.clearCache();
  });

  describe('findByEmail', () => {
    it('should return user when found', async () => {
      const result = await client.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockCircuitBreaker.fire).toHaveBeenCalledWith(
        'GET',
        '/users/email/test@example.com',
        undefined,
        undefined,
      );
    });

    it('should return null when user not found (404)', async () => {
      const error = {
        response: { status: 404 },
        message: 'Not Found',
      };

      mockCircuitBreaker.fire.mockRejectedValue(error);

      const result = await client.findByEmail('notfound@example.com');

      expect(result).toBeNull();
    });

    it('should use cached result on subsequent calls', async () => {
      // Setup cache mock to return undefined first, then return cached user
      const mockUserCacheService = (client as any).userCacheService;
      mockUserCacheService.getCachedUserByEmail
        .mockResolvedValueOnce(undefined) // First call - cache miss
        .mockResolvedValueOnce(mockUser); // Second call - cache hit

      // First call
      const result1 = await client.findByEmail('test@example.com');
      // Second call should use cache
      const result2 = await client.findByEmail('test@example.com');

      expect(result1).toEqual(mockUser);
      expect(result2).toEqual(mockUser);
      expect(mockCircuitBreaker.fire).toHaveBeenCalledTimes(1);
    });

    it('should throw ServiceUnavailableException when circuit breaker is open', async () => {
      mockCircuitBreaker.fire.mockRejectedValue(
        new ServiceUnavailableError('UserService is currently unavailable'),
      );

      await expect(client.findByEmail('test@example.com')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      const result = await client.findById(mockUser.id);

      expect(result).toEqual(mockUser);
      expect(mockCircuitBreaker.fire).toHaveBeenCalledWith(
        'GET',
        `/users/${mockUser.id}`,
        undefined,
        undefined,
      );
    });

    it('should return null when user not found (404)', async () => {
      const error = {
        response: { status: 404 },
        message: 'Not Found',
      };

      mockCircuitBreaker.fire.mockRejectedValue(error);

      const result = await client.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('createUser', () => {
    it('should create user successfully', async () => {
      const createUserDto: CreateUserDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashedPassword',
      };

      const result = await client.createUser(createUserDto);

      expect(result).toEqual(mockUser);
      expect(mockCircuitBreaker.fire).toHaveBeenCalledWith(
        'POST',
        '/users',
        createUserDto,
        undefined,
      );
    });

    it('should throw ServiceUnavailableException when circuit breaker is open', async () => {
      const createUserDto: CreateUserDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashedPassword',
      };

      mockCircuitBreaker.fire.mockRejectedValue(
        new ServiceUnavailableError('UserService is currently unavailable'),
      );

      await expect(client.createUser(createUserDto)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should re-throw conflict errors (409)', async () => {
      const createUserDto: CreateUserDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashedPassword',
      };

      const conflictError = {
        response: { status: 409 },
        message: 'Conflict',
      };

      mockCircuitBreaker.fire.mockRejectedValue(conflictError);

      await expect(client.createUser(createUserDto)).rejects.toEqual(conflictError);
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login successfully', async () => {
      await expect(client.updateLastLogin(mockUser.id)).resolves.not.toThrow();

      expect(mockCircuitBreaker.fire).toHaveBeenCalledWith(
        'PATCH',
        `/users/${mockUser.id}/last-login`,
        expect.objectContaining({
          lastLoginAt: expect.any(String),
        }),
        undefined,
      );
    });

    it('should not throw error when service is unavailable', async () => {
      mockCircuitBreaker.fire.mockRejectedValue(
        new ServiceUnavailableError('UserService is currently unavailable'),
      );

      // Should not throw error as this is not critical
      await expect(client.updateLastLogin(mockUser.id)).resolves.not.toThrow();
    });
  });

  describe('userExists', () => {
    it('should return true when user exists', async () => {
      mockCircuitBreaker.fire.mockResolvedValue({
        data: { exists: true, userId: mockUser.id },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await client.userExists(mockUser.id);

      expect(result).toBe(true);
      expect(mockCircuitBreaker.fire).toHaveBeenCalledWith(
        'GET',
        `/users/${mockUser.id}/exists`,
        undefined,
        undefined,
      );
    });

    it('should return false when user does not exist (404)', async () => {
      const error = {
        response: { status: 404 },
        message: 'Not Found',
      };

      mockCircuitBreaker.fire.mockRejectedValue(error);

      const result = await client.userExists('nonexistent-id');

      expect(result).toBe(false);
    });

    it('should use cache fallback when service is unavailable', async () => {
      // Setup cache mock to return cached user when service is unavailable
      const mockUserCacheService = (client as any).userCacheService;
      mockUserCacheService.getCachedUserById.mockResolvedValue(mockUser);

      // Make circuit breaker fail
      mockCircuitBreaker.fire.mockRejectedValue(
        new ServiceUnavailableError('UserService is currently unavailable'),
      );

      const result = await client.userExists(mockUser.id);

      expect(result).toBe(true); // Should return true from cache
    });

    it('should throw ServiceUnavailableException when service is unavailable and no cache', async () => {
      mockCircuitBreaker.fire.mockRejectedValue(
        new ServiceUnavailableError('UserService is currently unavailable'),
      );

      await expect(client.userExists('unknown-id')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('cache management', () => {
    it('should clear cache', () => {
      client.clearCache();
      const stats = client.getCacheStats();
      expect(stats.localSize).toBe(0);
    });

    it('should return cache statistics', () => {
      const stats = client.getCacheStats();
      expect(stats).toHaveProperty('localSize');
      expect(stats).toHaveProperty('maxSize');
      expect(typeof stats.localSize).toBe('number');
      expect(typeof stats.maxSize).toBe('number');
    });
  });

  describe('circuit breaker integration', () => {
    it('should return circuit breaker state', () => {
      const state = client.getCircuitBreakerState();
      expect(['CLOSED', 'OPEN', 'HALF_OPEN']).toContain(state);
    });

    it('should check if circuit breaker is open', () => {
      const isOpen = client.isCircuitBreakerOpen();
      expect(typeof isOpen).toBe('boolean');
    });

    it('should check if circuit breaker is half-open', () => {
      const isHalfOpen = client.isCircuitBreakerHalfOpen();
      expect(typeof isHalfOpen).toBe('boolean');
    });
  });
});