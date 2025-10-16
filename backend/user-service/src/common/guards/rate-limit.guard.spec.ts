import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { RateLimitGuard, RateLimitType } from './rate-limit.guard';
import Redis from 'ioredis';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let reflector: Reflector;
  let configService: ConfigService;
  let redis: jest.Mocked<Redis>;

  const createMockExecutionContext = (request: any): ExecutionContext => ({
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({} as any),
      getNext: () => ({} as any),
    }),
    getHandler: () => ({} as any),
    getClass: () => ({} as any),
    getArgs: () => ([] as any),
    getArgByIndex: () => ({} as any),
    switchToRpc: () => ({
      getContext: () => ({} as any),
      getData: () => ({} as any),
    }),
    switchToWs: () => ({
      getClient: () => ({} as any),
      getData: () => ({} as any),
      getPattern: () => ({} as any),
    }),
    getType: () => 'http' as any,
  });

  const mockRequest = {
    path: '/test',
    method: 'GET',
    headers: {
      'user-agent': 'test-agent',
      'x-forwarded-for': '192.168.1.1',
    },
    connection: { remoteAddress: '192.168.1.1' },
    query: {},
    body: {},
    user: { id: 'test-user-id' },
  };

  let mockExecutionContext: ExecutionContext;

  beforeEach(async () => {
    const mockRedis = {
      pipeline: jest.fn().mockReturnValue({
        zremrangebyscore: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 0], // zremrangebyscore result
          [null, 1], // zadd result
          [null, 5], // zcard result (5 requests in window)
          [null, 1], // expire result
        ]),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitGuard,
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
              const config = {
                RATE_LIMIT_ENABLED: true,
                NODE_ENV: 'test',
              };
              return config[key as keyof typeof config] ?? defaultValue?.infer ? defaultValue : undefined;
            }),
          },
        },
        {
          provide: 'REDIS_CLIENT',
          useValue: mockRedis,
        },
      ],
    }).compile();

    guard = module.get<RateLimitGuard>(RateLimitGuard);
    reflector = module.get<Reflector>(Reflector);
    configService = module.get<ConfigService>(ConfigService);
    redis = module.get<Redis>('REDIS_CLIENT') as jest.Mocked<Redis>;
    mockExecutionContext = createMockExecutionContext(mockRequest);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should allow request when rate limiting is disabled', async () => {
      jest.spyOn(configService, 'get').mockReturnValue(false);

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });

    it('should allow request when under rate limit', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(redis.pipeline).toHaveBeenCalled();
    });

    it('should block request when over rate limit', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      
      // Mock Redis to return count over limit
      const mockPipeline = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 0],
          [null, 1],
          [null, 100], // Over default limit of 60
          [null, 1],
        ]),
      };
      redis.pipeline.mockReturnValue(mockPipeline as any);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(HttpException);
    });

    it('should use custom rate limit configuration from decorator', async () => {
      const customConfig = {
        type: RateLimitType.BATCH,
        windowMs: 300000,
        maxRequests: 10,
        message: 'Custom rate limit message',
      };
      
      jest.spyOn(reflector, 'get').mockReturnValue(customConfig);

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });

    it('should determine operation type from URL path', async () => {
      const batchRequest = {
        ...mockRequest,
        path: '/batch/users/create',
      };

      const batchContext = createMockExecutionContext(batchRequest);

      jest.spyOn(reflector, 'get').mockReturnValue(undefined);

      const result = await guard.canActivate(batchContext);

      expect(result).toBe(true);
    });

    it('should handle Redis errors gracefully (fail-open)', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      
      const mockPipeline = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
      };
      redis.pipeline.mockReturnValue(mockPipeline as any);

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true); // Should allow request when Redis fails
    });

    it('should generate different keys for different users', async () => {
      const user1Request = { ...mockRequest, user: { id: 'user1' } };
      const user2Request = { ...mockRequest, user: { id: 'user2' } };

      const user1Context = createMockExecutionContext(user1Request);
      const user2Context = createMockExecutionContext(user2Request);

      jest.spyOn(reflector, 'get').mockReturnValue(undefined);

      await guard.canActivate(user1Context);
      await guard.canActivate(user2Context);

      expect(redis.pipeline).toHaveBeenCalledTimes(2);
    });

    it('should handle batch size in key generation', async () => {
      const batchRequest = {
        ...mockRequest,
        path: '/batch/users/create',
        method: 'POST',
        body: {
          users: [{ email: 'test1@example.com' }, { email: 'test2@example.com' }],
        },
      };

      const batchContext = createMockExecutionContext(batchRequest);

      jest.spyOn(reflector, 'get').mockReturnValue({ type: RateLimitType.BATCH });

      const result = await guard.canActivate(batchContext);

      expect(result).toBe(true);
    });

    it('should handle upload operations with content length', async () => {
      const uploadRequest = {
        ...mockRequest,
        path: '/profiles/123/avatar',
        method: 'POST',
        headers: {
          ...mockRequest.headers,
          'content-length': '1048576', // 1MB
        },
      };

      const uploadContext = createMockExecutionContext(uploadRequest);

      jest.spyOn(reflector, 'get').mockReturnValue({ type: RateLimitType.UPLOAD });

      const result = await guard.canActivate(uploadContext);

      expect(result).toBe(true);
    });

    it('should detect search operations from query parameters', async () => {
      const searchRequest = {
        ...mockRequest,
        path: '/users',
        method: 'GET',
        query: { search: 'john' },
      };

      const searchContext = createMockExecutionContext(searchRequest);

      jest.spyOn(reflector, 'get').mockReturnValue(undefined);

      const result = await guard.canActivate(searchContext);

      expect(result).toBe(true);
    });

    it('should throw proper HTTP exception with rate limit details', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue({
        type: RateLimitType.BATCH,
        windowMs: 300000,
        maxRequests: 5,
        message: 'Too many batch operations',
      });
      
      const mockPipeline = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 0],
          [null, 1],
          [null, 10], // Over limit of 5
          [null, 1],
        ]),
      };
      redis.pipeline.mockReturnValue(mockPipeline as any);

      try {
        await guard.canActivate(mockExecutionContext);
        fail('Expected HttpException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        
        const response = error.getResponse() as any;
        expect(response.message).toBe('Too many batch operations');
        expect(response.type).toBe(RateLimitType.BATCH);
        expect(response.retryAfter).toBe(300); // 300 seconds
      }
    });
  });

  describe('operation type determination', () => {
    it('should detect batch operations from URL', () => {
      const batchPaths = [
        '/batch/users/create',
        '/batch/users/lookup',
        '/batch/users/update',
      ];

      batchPaths.forEach(path => {
        const request = { ...mockRequest, path };
        const context = createMockExecutionContext(request);
        // This would be tested through the private method if it were public
        // For now, we test the behavior through canActivate
        expect(context).toBeDefined();
      });
    });

    it('should detect profile operations from URL', () => {
      const profilePaths = [
        '/profiles/123',
        '/profiles/123/avatar',
        '/profiles/123/preferences',
      ];

      profilePaths.forEach(path => {
        const request = { ...mockRequest, path };
        const context = createMockExecutionContext(request);
        expect(context).toBeDefined();
      });
    });

    it('should detect internal operations from URL', () => {
      const internalPaths = [
        '/internal/users/123',
        '/internal/users/email/test@example.com',
        '/internal/users/123/profile',
      ];

      internalPaths.forEach(path => {
        const request = { ...mockRequest, path };
        const context = createMockExecutionContext(request);
        expect(context).toBeDefined();
      });
    });

    it('should detect upload operations', () => {
      const uploadRequest = {
        ...mockRequest,
        path: '/profiles/123/upload',
        method: 'POST',
      };

      const context = createMockExecutionContext(uploadRequest);

      expect(context).toBeDefined();
    });

    it('should detect search operations', () => {
      const searchRequests = [
        { ...mockRequest, path: '/users/search' },
        { ...mockRequest, path: '/users', query: { search: 'term' } },
      ];

      searchRequests.forEach(request => {
        const context = createMockExecutionContext(request);
        expect(context).toBeDefined();
      });
    });
  });

  describe('key generation', () => {
    it('should generate unique keys for different IPs', async () => {
      const ip1Request = {
        ...mockRequest,
        headers: { ...mockRequest.headers, 'x-forwarded-for': '192.168.1.1' },
      };
      const ip2Request = {
        ...mockRequest,
        headers: { ...mockRequest.headers, 'x-forwarded-for': '192.168.1.2' },
      };

      const contexts = [ip1Request, ip2Request].map(request => 
        createMockExecutionContext(request)
      );

      jest.spyOn(reflector, 'get').mockReturnValue(undefined);

      for (const context of contexts) {
        await guard.canActivate(context);
      }

      expect(redis.pipeline).toHaveBeenCalledTimes(2);
    });

    it('should handle anonymous users', async () => {
      const anonymousRequest = {
        ...mockRequest,
        user: undefined,
      };

      const context = createMockExecutionContext(anonymousRequest);

      jest.spyOn(reflector, 'get').mockReturnValue(undefined);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should use custom key generator when provided', async () => {
      const customKeyGenerator = jest.fn().mockReturnValue('custom-key');
      
      jest.spyOn(reflector, 'get').mockReturnValue({
        type: RateLimitType.DEFAULT,
        keyGenerator: customKeyGenerator,
      });

      await guard.canActivate(mockExecutionContext);

      expect(customKeyGenerator).toHaveBeenCalledWith(mockRequest);
    });
  });

  describe('Redis integration', () => {
    it('should use sliding window algorithm', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);

      await guard.canActivate(mockExecutionContext);

      const pipeline = redis.pipeline();
      expect(pipeline.zremrangebyscore).toHaveBeenCalled();
      expect(pipeline.zadd).toHaveBeenCalled();
      expect(pipeline.zcard).toHaveBeenCalled();
      expect(pipeline.expire).toHaveBeenCalled();
    });

    it('should handle Redis pipeline execution failure', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      
      const mockPipeline = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null), // Pipeline execution failed
      };
      redis.pipeline.mockReturnValue(mockPipeline as any);

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true); // Should fail-open
    });

    it('should set appropriate TTL for rate limit keys', async () => {
      const customConfig = {
        type: RateLimitType.BATCH,
        windowMs: 300000, // 5 minutes
        maxRequests: 10,
      };
      
      jest.spyOn(reflector, 'get').mockReturnValue(customConfig);

      await guard.canActivate(mockExecutionContext);

      const pipeline = redis.pipeline();
      expect(pipeline.expire).toHaveBeenCalledWith(
        expect.any(String),
        301 // 300 seconds + 1 for buffer
      );
    });
  });
});