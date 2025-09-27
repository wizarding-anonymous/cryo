import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RateLimitService } from './rate-limit.service';
import { RedisService } from '../redis/redis.service';

describe('RateLimitService', () => {
  let service: RateLimitService;
  let redisService: jest.Mocked<RedisService>;
  let configService: jest.Mocked<ConfigService>;
  let mockRedisClient: any;

  beforeEach(async () => {
    mockRedisClient = {
      multi: jest.fn().mockReturnThis(),
      zremrangebyscore: jest.fn().mockReturnThis(),
      zcard: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      pexpire: jest.fn().mockReturnThis(),
      zrange: jest.fn(),
      exec: jest.fn(),
    };

    const mockRedisService = {
      getClient: jest.fn().mockReturnValue(mockRedisClient),
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          RATE_LIMIT_ENABLED: true,
          RATE_LIMIT_WINDOW_MS: 60000,
          RATE_LIMIT_MAX_REQUESTS: 100,
        };
        return config[key] ?? defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<RateLimitService>(RateLimitService);
    redisService = module.get(RedisService);
    configService = module.get(ConfigService);
  });

  describe('isEnabled', () => {
    it('should return true when rate limiting is enabled', () => {
      expect(service.isEnabled()).toBe(true);
    });

    it('should return false when rate limiting is disabled', async () => {
      configService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          if (key === 'RATE_LIMIT_ENABLED') return false;
          return defaultValue;
        },
      );

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RateLimitService,
          { provide: RedisService, useValue: redisService },
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();

      const disabledService = module.get<RateLimitService>(RateLimitService);
      expect(disabledService.isEnabled()).toBe(false);
    });
  });

  describe('check', () => {
    beforeEach(() => {
      mockRedisClient.exec.mockResolvedValue([
        [null, 0], // zremrangebyscore result
        [null, 5], // zcard result - current count
      ]);
    });

    it('should allow request when within default limits', async () => {
      const result = await service.check('192.168.1.1', '/api/test', 'GET');

      expect(result).toEqual({
        allowed: true,
        limit: 100,
        remaining: 94, // 100 - (5 + 1)
        reset: expect.any(Number),
        windowMs: 60000,
      });

      expect(mockRedisClient.multi).toHaveBeenCalled();
      expect(mockRedisClient.zremrangebyscore).toHaveBeenCalled();
      expect(mockRedisClient.zcard).toHaveBeenCalled();
      expect(mockRedisClient.zadd).toHaveBeenCalled();
      expect(mockRedisClient.pexpire).toHaveBeenCalled();
    });

    it('should apply specific limits for auth routes', async () => {
      mockRedisClient.exec.mockResolvedValueOnce([
        [null, 0], // zremrangebyscore result
        [null, 5], // zcard result - current count
      ]);

      const result = await service.check(
        '192.168.1.1',
        '/api/auth/login',
        'POST',
      );

      expect(result).toEqual({
        allowed: true,
        limit: 10, // Auth route specific limit
        remaining: 4, // 10 - (5 + 1)
        reset: expect.any(Number),
        windowMs: 60000,
      });
    });

    it('should apply specific limits for payment routes', async () => {
      mockRedisClient.exec.mockResolvedValueOnce([
        [null, 0], // zremrangebyscore result
        [null, 15], // zcard result - current count
      ]);

      const result = await service.check(
        '192.168.1.1',
        '/api/payments/create',
        'POST',
      );

      expect(result).toEqual({
        allowed: true,
        limit: 20, // Payment route specific limit
        remaining: 4, // 20 - (15 + 1)
        reset: expect.any(Number),
        windowMs: 60000,
      });
    });

    it('should apply higher limits for game catalog routes', async () => {
      mockRedisClient.exec.mockResolvedValueOnce([
        [null, 0], // zremrangebyscore result
        [null, 150], // zcard result - current count
      ]);

      const result = await service.check('192.168.1.1', '/api/games', 'GET');

      expect(result).toEqual({
        allowed: true,
        limit: 200, // Games route specific limit
        remaining: 49, // 200 - (150 + 1)
        reset: expect.any(Number),
        windowMs: 60000,
      });
    });

    it('should deny request when limit exceeded', async () => {
      mockRedisClient.exec.mockResolvedValueOnce([
        [null, 0], // zremrangebyscore result
        [null, 10], // zcard result - current count equals limit for auth
      ]);

      mockRedisClient.zrange.mockResolvedValueOnce([
        '1234567890',
        '1234567890',
      ]);

      const result = await service.check(
        '192.168.1.1',
        '/api/auth/login',
        'POST',
      );

      expect(result).toEqual({
        allowed: false,
        limit: 10,
        remaining: 0,
        reset: expect.any(Number),
        windowMs: 60000,
      });

      // Should not add new request when limit exceeded
      expect(mockRedisClient.zadd).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.exec.mockResolvedValueOnce([
        [new Error('Redis error'), null],
        [null, 0],
      ]);

      const result = await service.check('192.168.1.1', '/api/test', 'GET');

      expect(result).toEqual({
        allowed: true,
        limit: 100,
        remaining: 99, // 100 - (0 + 1) when error occurs, current defaults to 0
        reset: expect.any(Number),
        windowMs: 60000,
      });
    });

    it('should generate correct Redis keys', async () => {
      await service.check('192.168.1.1', '/api/test/path', 'GET');

      expect(mockRedisClient.zremrangebyscore).toHaveBeenCalledWith(
        'ratelimit:192.168.1.1:GET:/api/test/path',
        0,
        expect.any(Number),
      );
    });

    it('should handle long routes by truncating', async () => {
      const longRoute = '/api/' + 'a'.repeat(200);
      await service.check('192.168.1.1', longRoute, 'GET');

      const expectedKey = `ratelimit:192.168.1.1:GET:${longRoute.slice(0, 128)}`;
      expect(mockRedisClient.zremrangebyscore).toHaveBeenCalledWith(
        expectedKey,
        0,
        expect.any(Number),
      );
    });
  });

  describe('route pattern matching', () => {
    it('should match exact routes', async () => {
      mockRedisClient.exec.mockResolvedValue([
        [null, 0],
        [null, 5],
      ]);

      // Test exact match for games route
      const result = await service.check('192.168.1.1', '/api/games', 'GET');
      expect(result.limit).toBe(200); // Games specific limit
    });

    it('should match wildcard patterns', async () => {
      mockRedisClient.exec.mockResolvedValue([
        [null, 0],
        [null, 5],
      ]);

      // Test wildcard match for auth subroutes
      const result = await service.check(
        '192.168.1.1',
        '/api/auth/register',
        'POST',
      );
      expect(result.limit).toBe(10); // Auth specific limit
    });

    it('should fall back to default for unmatched routes', async () => {
      mockRedisClient.exec.mockResolvedValue([
        [null, 0],
        [null, 5],
      ]);

      // Test unmatched route
      const result = await service.check('192.168.1.1', '/api/unknown', 'GET');
      expect(result.limit).toBe(100); // Default limit
    });
  });
});
