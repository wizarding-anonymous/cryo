import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitService } from '../../modules/security/rate-limit.service';
import { RATE_LIMIT_META_KEY, RateLimitOptions } from '../decorators/rate-limit.decorator';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let reflector: jest.Mocked<Reflector>;
  let rateLimitService: jest.Mocked<RateLimitService>;
  let mockContext: jest.Mocked<ExecutionContext>;
  let mockRequest: any;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    rateLimitService = {
      checkRateLimit: jest.fn(),
    } as any;

    mockRequest = {
      ip: '192.168.1.1',
      headers: {},
      path: '/api/test',
    };

    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => mockRequest,
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;

    guard = new RateLimitGuard(reflector, rateLimitService);
  });

  describe('canActivate', () => {
    it('should return true when no rate limit options are set', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(rateLimitService.checkRateLimit).not.toHaveBeenCalled();
    });

    it('should allow request when rate limit is not exceeded (IP-based)', async () => {
      const options: RateLimitOptions = {
        name: 'test-limit',
        limit: 10,
        window: 60,
        keyBy: 'ip',
      };
      reflector.getAllAndOverride.mockReturnValue(options);
      rateLimitService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 5,
        resetInSeconds: 30,
      });

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
        'security:guard:test-limit:192.168.1.1',
        10,
        60,
      );
    });

    it('should use x-forwarded-for header when available', async () => {
      const options: RateLimitOptions = {
        name: 'test-limit',
        limit: 10,
        window: 60,
      };
      mockRequest.headers['x-forwarded-for'] = '203.0.113.1, 192.168.1.1';
      reflector.getAllAndOverride.mockReturnValue(options);
      rateLimitService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 5,
        resetInSeconds: 30,
      });

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
        'security:guard:test-limit:203.0.113.1',
        10,
        60,
      );
    });

    it('should use user ID when keyBy is user and user is authenticated', async () => {
      const options: RateLimitOptions = {
        name: 'user-limit',
        limit: 5,
        window: 300,
        keyBy: 'user',
      };
      mockRequest.user = { id: 'user123' };
      reflector.getAllAndOverride.mockReturnValue(options);
      rateLimitService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 2,
        resetInSeconds: 120,
      });

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
        'security:guard:user-limit:user123',
        5,
        300,
      );
    });

    it('should fallback to IP when keyBy is user but no user is authenticated', async () => {
      const options: RateLimitOptions = {
        name: 'user-limit',
        limit: 5,
        window: 300,
        keyBy: 'user',
      };
      reflector.getAllAndOverride.mockReturnValue(options);
      rateLimitService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 2,
        resetInSeconds: 120,
      });

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
        'security:guard:user-limit:ip:192.168.1.1',
        5,
        300,
      );
    });

    it('should use path when keyBy is path', async () => {
      const options: RateLimitOptions = {
        name: 'path-limit',
        limit: 100,
        window: 60,
        keyBy: 'path',
      };
      reflector.getAllAndOverride.mockReturnValue(options);
      rateLimitService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 50,
        resetInSeconds: 30,
      });

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
        'security:guard:path-limit:/api/test',
        100,
        60,
      );
    });

    it('should throw HttpException when rate limit is exceeded', async () => {
      const options: RateLimitOptions = {
        name: 'test-limit',
        limit: 10,
        window: 60,
      };
      reflector.getAllAndOverride.mockReturnValue(options);
      rateLimitService.checkRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetInSeconds: 45,
      });

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS),
      );
    });

    it('should default to IP-based limiting when keyBy is not specified', async () => {
      const options: RateLimitOptions = {
        name: 'default-limit',
        limit: 20,
        window: 120,
      };
      reflector.getAllAndOverride.mockReturnValue(options);
      rateLimitService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 10,
        resetInSeconds: 60,
      });

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
        'security:guard:default-limit:192.168.1.1',
        20,
        120,
      );
    });
  });
});