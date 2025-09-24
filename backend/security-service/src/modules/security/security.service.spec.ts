import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SecurityService } from './security.service';
import { LoggingService } from '../logs/logging.service';
import { RateLimitService } from './rate-limit.service';
import { ConfigService } from '@nestjs/config';
import { IPBlock } from '../../entities/ip-block.entity';
import { REDIS_CLIENT } from '../../redis/redis.constants';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { MetricsService } from '../../common/metrics/metrics.service';
import { UserServiceClient } from '../../clients/user-service.client';

const repoMock = () => ({
  create: jest.fn((x) => ({ id: '1', ...x })),
  save: jest.fn(async (x) => ({ id: '1', ...x })),
  findOne: jest.fn(async () => null as any),
});

const redisMock = () => ({
  get: jest.fn(async () => null as any),
  set: jest.fn(async () => 'OK'),
  del: jest.fn(async () => 1),
});

describe('SecurityService', () => {
  let service: SecurityService;
  let ipRepo: ReturnType<typeof repoMock>;
  let loggingService: jest.Mocked<LoggingService>;
  let rateLimitService: jest.Mocked<RateLimitService>;
  let configService: jest.Mocked<ConfigService>;
  let redis: ReturnType<typeof redisMock>;
  let metricsService: jest.Mocked<MetricsService>;
  let userServiceClient: jest.Mocked<UserServiceClient>;

  beforeEach(async () => {
    ipRepo = repoMock();
    redis = redisMock();
    
    loggingService = {
      logSecurityEvent: jest.fn().mockResolvedValue({ id: 'event1' }),
    } as any;

    rateLimitService = {
      checkRateLimit: jest.fn().mockResolvedValue({
        allowed: true,
        remaining: 10,
        resetInSeconds: 60,
      }),
      getRemainingRequests: jest.fn().mockResolvedValue(5),
    } as any;

    configService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          SECURITY_LOGIN_PER_MINUTE_IP: 20,
          SECURITY_LOGIN_PER_MINUTE_USER: 10,
          SECURITY_TXN_PER_MINUTE_USER: 15,
          SECURITY_TXN_AMOUNT_THRESHOLD: 10000,
          SECURITY_ACTIVITY_PER_MINUTE: 60,
        };
        return config[key] ?? defaultValue;
      }),
    } as any;

    metricsService = {
      recordCheck: jest.fn(),
      recordIpBlock: jest.fn(),
    } as any;

    userServiceClient = {
      getUserSecurityInfo: jest.fn(),
    } as any;

    const moduleRef = await Test.createTestingModule({
      providers: [
        SecurityService,
        { provide: LoggingService, useValue: loggingService },
        { provide: RateLimitService, useValue: rateLimitService },
        { provide: ConfigService, useValue: configService },
        { provide: getRepositoryToken(IPBlock), useValue: ipRepo },
        { provide: REDIS_CLIENT, useValue: redis },
        { provide: WINSTON_MODULE_NEST_PROVIDER, useValue: { info: jest.fn(), warn: jest.fn() } },
        { provide: MetricsService, useValue: metricsService },
        { provide: UserServiceClient, useValue: userServiceClient },
      ],
    }).compile();

    service = moduleRef.get(SecurityService);
  });

  describe('checkLoginSecurity', () => {
    it('should block login when IP is blocked', async () => {
      redis.get.mockResolvedValue('1');
      
      const result = await service.checkLoginSecurity({ 
        userId: 'user1', 
        ip: '1.2.3.4', 
        userAgent: 'test-agent' 
      });
      
      expect(result.allowed).toBe(false);
      expect(result.riskScore).toBe(100);
      expect(result.reason).toBe('IP is blocked');
      expect(result.recommendations).toContain('BLOCK_IP');
      expect(loggingService.logSecurityEvent).toHaveBeenCalled();
    });

    it('should allow login when rate limits are not exceeded', async () => {
      redis.get.mockResolvedValue(null);
      rateLimitService.checkRateLimit
        .mockResolvedValueOnce({
          allowed: true,
          remaining: 15, // IP: 15 remaining out of 20
          resetInSeconds: 60,
        })
        .mockResolvedValueOnce({
          allowed: true,
          remaining: 8, // User: 8 remaining out of 10
          resetInSeconds: 60,
        });

      const result = await service.checkLoginSecurity({
        userId: 'user1',
        ip: '1.2.3.4',
        userAgent: 'test-agent',
      });

      expect(result.allowed).toBe(true);
      expect(result.riskScore).toBeGreaterThanOrEqual(10); // Should be at least base risk (10)
      expect(rateLimitService.checkRateLimit).toHaveBeenCalledTimes(2); // IP and User
      expect(loggingService.logSecurityEvent).toHaveBeenCalled();
      expect(metricsService.recordCheck).toHaveBeenCalledWith('login', true, 0);
    });

    it('should block login when rate limit is exceeded', async () => {
      redis.get.mockResolvedValue(null);
      rateLimitService.checkRateLimit
        .mockResolvedValueOnce({ allowed: false, remaining: 0, resetInSeconds: 120 })
        .mockResolvedValueOnce({ allowed: true, remaining: 5, resetInSeconds: 60 });

      const result = await service.checkLoginSecurity({
        userId: 'user1',
        ip: '1.2.3.4',
        userAgent: 'test-agent',
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Rate limit exceeded');
      expect(result.riskScore).toBeGreaterThanOrEqual(85);
    });

    it('should increase risk score based on rate limit usage', async () => {
      redis.get.mockResolvedValue(null);
      rateLimitService.checkRateLimit
        .mockResolvedValueOnce({ allowed: true, remaining: 2, resetInSeconds: 60 }) // IP: high usage
        .mockResolvedValueOnce({ allowed: true, remaining: 1, resetInSeconds: 60 }); // User: high usage

      const result = await service.checkLoginSecurity({
        userId: 'user1',
        ip: '1.2.3.4',
        userAgent: 'test-agent',
      });

      expect(result.allowed).toBe(true);
      expect(result.riskScore).toBeGreaterThan(50); // Should be higher due to high usage
    });

    it('should integrate with user service when available', async () => {
      redis.get.mockResolvedValue(null);
      userServiceClient.getUserSecurityInfo.mockResolvedValue({
        locked: false,
        flagged: true,
      });

      const result = await service.checkLoginSecurity({
        userId: 'user1',
        ip: '1.2.3.4',
        userAgent: 'test-agent',
      });

      expect(result.allowed).toBe(true);
      expect(result.riskScore).toBeGreaterThan(10); // Should be increased due to flagged user
      expect(userServiceClient.getUserSecurityInfo).toHaveBeenCalledWith('user1');
    });

    it('should block login for locked user', async () => {
      redis.get.mockResolvedValue(null);
      userServiceClient.getUserSecurityInfo.mockResolvedValue({
        locked: true,
        flagged: false,
      });

      const result = await service.checkLoginSecurity({
        userId: 'user1',
        ip: '1.2.3.4',
        userAgent: 'test-agent',
      });

      expect(result.allowed).toBe(false);
      expect(result.riskScore).toBe(100);
      expect(result.reason).toBe('User is locked');
    });

    it('should handle user service errors gracefully', async () => {
      redis.get.mockResolvedValue(null);
      userServiceClient.getUserSecurityInfo.mockRejectedValue(new Error('Service unavailable'));

      const result = await service.checkLoginSecurity({
        userId: 'user1',
        ip: '1.2.3.4',
        userAgent: 'test-agent',
      });

      expect(result.allowed).toBe(true); // Should not fail due to external service error
    });
  });

  describe('checkTransactionSecurity', () => {
    it('should block transaction when IP is blocked', async () => {
      redis.get.mockResolvedValue('1');

      const result = await service.checkTransactionSecurity({
        userId: 'user1',
        amount: 1000,
        paymentMethod: 'card',
        ip: '1.2.3.4',
      });

      expect(result.allowed).toBe(false);
      expect(result.riskScore).toBe(100);
      expect(result.reason).toBe('IP is blocked');
    });

    it('should allow normal transaction', async () => {
      redis.get.mockResolvedValue(null);
      rateLimitService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 10,
        resetInSeconds: 60,
      });

      const result = await service.checkTransactionSecurity({
        userId: 'user1',
        amount: 1000,
        paymentMethod: 'card',
        ip: '1.2.3.4',
      });

      expect(result.allowed).toBe(true);
      expect(result.riskScore).toBeGreaterThanOrEqual(15);
      expect(metricsService.recordCheck).toHaveBeenCalledWith('transaction', true, 0);
    });

    it('should increase risk for high amount transactions', async () => {
      redis.get.mockResolvedValue(null);
      rateLimitService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 10,
        resetInSeconds: 60,
      });

      const result = await service.checkTransactionSecurity({
        userId: 'user1',
        amount: 15000, // Above threshold
        paymentMethod: 'card',
        ip: '1.2.3.4',
      });

      expect(result.allowed).toBe(true);
      expect(result.riskScore).toBeGreaterThan(45); // Base + high amount penalty
      expect(result.reason).toBe('High amount transaction');
    });

    it('should block when transaction rate limit exceeded', async () => {
      redis.get.mockResolvedValue(null);
      rateLimitService.checkRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetInSeconds: 120,
      });

      const result = await service.checkTransactionSecurity({
        userId: 'user1',
        amount: 1000,
        paymentMethod: 'card',
        ip: '1.2.3.4',
      });

      expect(result.allowed).toBe(false);
      expect(result.riskScore).toBeGreaterThanOrEqual(85);
      expect(result.reason).toBe('Rate limit exceeded');
    });

    it('should combine reasons for high amount and rate limit', async () => {
      redis.get.mockResolvedValue(null);
      rateLimitService.checkRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetInSeconds: 120,
      });

      const result = await service.checkTransactionSecurity({
        userId: 'user1',
        amount: 15000,
        paymentMethod: 'card',
        ip: '1.2.3.4',
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('High amount transaction; Rate limit exceeded');
    });
  });

  describe('blockIP', () => {
    it('should block IP and warm Redis cache', async () => {
      const ip = '1.2.3.4';
      const reason = 'Suspicious activity';
      const durationMinutes = 30;

      await service.blockIP(ip, reason, durationMinutes);

      expect(ipRepo.create).toHaveBeenCalledWith({
        ip,
        reason,
        blockedUntil: expect.any(Date),
        isActive: true,
      });
      expect(ipRepo.save).toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalledWith(
        'security:block:ip:1.2.3.4',
        '1',
        'EX',
        1800 // 30 minutes in seconds
      );
      expect(loggingService.logSecurityEvent).toHaveBeenCalled();
      expect(metricsService.recordIpBlock).toHaveBeenCalledWith(reason);
    });
  });

  describe('isIPBlocked', () => {
    it('should return true when IP is cached as blocked', async () => {
      redis.get.mockResolvedValue('1');

      const result = await service.isIPBlocked('1.2.3.4');

      expect(result).toBe(true);
      expect(redis.get).toHaveBeenCalledWith('security:block:ip:1.2.3.4');
    });

    it('should return false when IP is not blocked', async () => {
      redis.get.mockResolvedValue(null);
      ipRepo.findOne.mockResolvedValue(null);

      const result = await service.isIPBlocked('1.2.3.4');

      expect(result).toBe(false);
    });

    it('should return true when IP is actively blocked in database', async () => {
      redis.get.mockResolvedValue(null);
      const futureDate = new Date(Date.now() + 60000);
      ipRepo.findOne.mockResolvedValue({
        id: '1',
        ip: '1.2.3.4',
        isActive: true,
        blockedUntil: futureDate,
      } as any);

      const result = await service.isIPBlocked('1.2.3.4');

      expect(result).toBe(true);
    });

    it('should deactivate expired blocks', async () => {
      redis.get.mockResolvedValue(null);
      const pastDate = new Date(Date.now() - 60000);
      const expiredBlock = {
        id: '1',
        ip: '1.2.3.4',
        isActive: true,
        blockedUntil: pastDate,
      } as any;
      ipRepo.findOne.mockResolvedValue(expiredBlock);

      const result = await service.isIPBlocked('1.2.3.4');

      expect(result).toBe(false);
      expect(expiredBlock.isActive).toBe(false);
      expect(ipRepo.save).toHaveBeenCalledWith(expiredBlock);
    });

    it('should return false on storage errors', async () => {
      redis.get.mockRejectedValue(new Error('Redis error'));

      const result = await service.isIPBlocked('1.2.3.4');

      expect(result).toBe(false);
    });
  });

  describe('validateUserActivity', () => {
    it('should validate user activity within limits', async () => {
      rateLimitService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 30,
        resetInSeconds: 60,
      });

      const result = await service.validateUserActivity('user1', 'login');

      expect(result).toBe(true);
      expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
        'security:rl:act:login:user:user1:1m',
        60,
        60
      );
    });

    it('should reject user activity when limits exceeded', async () => {
      rateLimitService.checkRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetInSeconds: 120,
      });

      const result = await service.validateUserActivity('user1', 'login');

      expect(result).toBe(false);
    });
  });

  describe('calculateRiskScore', () => {
    beforeEach(() => {
      rateLimitService.getRemainingRequests.mockResolvedValue(5);
    });

    it('should calculate base risk score', async () => {
      redis.get.mockResolvedValue(null);

      const score = await service.calculateRiskScore('user1', {});

      expect(score).toBeGreaterThanOrEqual(5);
      expect(score).toBeLessThan(100);
    });

    it('should return 100 for blocked IP', async () => {
      redis.get.mockResolvedValue('1');

      const score = await service.calculateRiskScore('user1', { ip: '1.2.3.4' });

      expect(score).toBe(100);
    });

    it('should increase score for high amounts', async () => {
      redis.get.mockResolvedValue(null);

      const score = await service.calculateRiskScore('user1', { amount: 15000 });

      expect(score).toBeGreaterThan(25); // Base + amount penalty
    });

    it('should increase score based on rate limit usage', async () => {
      redis.get.mockResolvedValue(null);
      rateLimitService.getRemainingRequests
        .mockResolvedValueOnce(2) // IP rate limit
        .mockResolvedValueOnce(1); // User rate limit

      const score = await service.calculateRiskScore('user1', { ip: '1.2.3.4' });

      expect(score).toBeGreaterThan(50); // Should be high due to low remaining requests
    });

    it('should return 100 for locked users', async () => {
      redis.get.mockResolvedValue(null);
      userServiceClient.getUserSecurityInfo.mockResolvedValue({
        locked: true,
        flagged: false,
      });

      const score = await service.calculateRiskScore('user1', {});

      expect(score).toBe(100);
    });

    it('should increase score for flagged users', async () => {
      redis.get.mockResolvedValue(null);
      userServiceClient.getUserSecurityInfo.mockResolvedValue({
        locked: false,
        flagged: true,
      });

      const baseScore = await service.calculateRiskScore('user1', {});
      
      expect(baseScore).toBeGreaterThan(15); // Base + flagged penalty
    });

    it('should handle user service errors gracefully', async () => {
      redis.get.mockResolvedValue(null);
      userServiceClient.getUserSecurityInfo.mockRejectedValue(new Error('Service error'));

      const score = await service.calculateRiskScore('user1', {});

      expect(score).toBeGreaterThanOrEqual(5);
      expect(score).toBeLessThan(100);
    });

    it('should cap score at 99', async () => {
      redis.get.mockResolvedValue(null);
      rateLimitService.getRemainingRequests.mockResolvedValue(0); // Maximum usage
      userServiceClient.getUserSecurityInfo.mockResolvedValue({
        locked: false,
        flagged: true,
      });

      const score = await service.calculateRiskScore('user1', { 
        ip: '1.2.3.4', 
        amount: 50000 
      });

      expect(score).toBeLessThan(100);
    });

    it('should handle context without IP', async () => {
      redis.get.mockResolvedValue(null);
      rateLimitService.getRemainingRequests.mockResolvedValue(8);

      const score = await service.calculateRiskScore('user1', { amount: 5000 });

      expect(score).toBeGreaterThanOrEqual(5);
      expect(score).toBeLessThan(100);
    });

    it('should handle context with zero amount', async () => {
      redis.get.mockResolvedValue(null);

      const score = await service.calculateRiskScore('user1', { amount: 0 });

      expect(score).toBeGreaterThanOrEqual(5);
      expect(score).toBeLessThan(100);
    });

    it('should handle missing user service gracefully', async () => {
      // Create service without user service
      const moduleRef = await Test.createTestingModule({
        providers: [
          SecurityService,
          { provide: LoggingService, useValue: loggingService },
          { provide: RateLimitService, useValue: rateLimitService },
          { provide: ConfigService, useValue: configService },
          { provide: getRepositoryToken(IPBlock), useValue: ipRepo },
          { provide: REDIS_CLIENT, useValue: redis },
          { provide: WINSTON_MODULE_NEST_PROVIDER, useValue: { info: jest.fn(), warn: jest.fn() } },
          { provide: MetricsService, useValue: metricsService },
          // No UserServiceClient provided
        ],
      }).compile();

      const serviceWithoutUserClient = moduleRef.get(SecurityService);
      redis.get.mockResolvedValue(null);

      const score = await serviceWithoutUserClient.calculateRiskScore('user1', {});

      expect(score).toBeGreaterThanOrEqual(5);
      expect(score).toBeLessThan(100);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle Redis errors in checkLoginSecurity', async () => {
      redis.get.mockRejectedValue(new Error('Redis connection failed'));
      rateLimitService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 10,
        resetInSeconds: 60,
      });

      const result = await service.checkLoginSecurity({
        userId: 'user1',
        ip: '1.2.3.4',
        userAgent: 'test-agent',
      });

      expect(result.allowed).toBe(true);
      expect(result.riskScore).toBeGreaterThanOrEqual(10);
    });

    it('should handle missing optional fields in checkLoginSecurity', async () => {
      redis.get.mockResolvedValue(null);
      rateLimitService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 10,
        resetInSeconds: 60,
      });

      const result = await service.checkLoginSecurity({
        userId: 'user1',
        ip: '1.2.3.4',
        // Missing userAgent
      });

      expect(result.allowed).toBe(true);
      expect(loggingService.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: undefined,
        })
      );
    });

    it('should handle missing optional fields in checkTransactionSecurity', async () => {
      redis.get.mockResolvedValue(null);
      rateLimitService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 10,
        resetInSeconds: 60,
      });

      const result = await service.checkTransactionSecurity({
        userId: 'user1',
        amount: 1000,
        paymentMethod: 'card',
        ip: '1.2.3.4',
        // Missing context
      });

      expect(result.allowed).toBe(true);
      expect(loggingService.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            context: undefined,
          }),
        })
      );
    });

    it('should handle zero or negative amounts in checkTransactionSecurity', async () => {
      redis.get.mockResolvedValue(null);
      rateLimitService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 10,
        resetInSeconds: 60,
      });

      const result = await service.checkTransactionSecurity({
        userId: 'user1',
        amount: 0,
        paymentMethod: 'card',
        ip: '1.2.3.4',
      });

      expect(result.allowed).toBe(true);
      expect(result.riskScore).toBeGreaterThanOrEqual(15);
      expect(result.reason).toBeUndefined(); // No high amount reason
    });

    it('should handle missing amount in checkTransactionSecurity', async () => {
      redis.get.mockResolvedValue(null);
      rateLimitService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 10,
        resetInSeconds: 60,
      });

      const result = await service.checkTransactionSecurity({
        userId: 'user1',
        amount: undefined as any,
        paymentMethod: 'card',
        ip: '1.2.3.4',
      });

      expect(result.allowed).toBe(true);
      expect(result.riskScore).toBeGreaterThanOrEqual(15);
      expect(result.reason).toBeUndefined(); // No high amount reason
    });

    it('should handle database errors in blockIP gracefully', async () => {
      ipRepo.save.mockRejectedValue(new Error('Database connection failed'));

      await expect(service.blockIP('1.2.3.4', 'Test reason', 30)).rejects.toThrow('Database connection failed');
    });

    it('should handle Redis errors in blockIP gracefully', async () => {
      redis.set.mockRejectedValue(new Error('Redis connection failed'));

      await expect(service.blockIP('1.2.3.4', 'Test reason', 30)).rejects.toThrow('Redis connection failed');
    });

    it('should handle database errors in isIPBlocked gracefully', async () => {
      redis.get.mockResolvedValue(null);
      ipRepo.findOne.mockRejectedValue(new Error('Database connection failed'));

      const result = await service.isIPBlocked('1.2.3.4');

      expect(result).toBe(false); // Should default to not blocked on error
    });

    it('should handle rate limit service errors in validateUserActivity', async () => {
      rateLimitService.checkRateLimit.mockRejectedValue(new Error('Rate limit service failed'));

      await expect(service.validateUserActivity('user1', 'login')).rejects.toThrow('Rate limit service failed');
    });

    it('should handle rate limit service errors in calculateRiskScore', async () => {
      redis.get.mockResolvedValue(null);
      rateLimitService.getRemainingRequests.mockRejectedValue(new Error('Rate limit service failed'));

      await expect(service.calculateRiskScore('user1', { ip: '1.2.3.4' })).rejects.toThrow('Rate limit service failed');
    });
  });

  describe('Configuration and Environment', () => {
    it('should use default configuration values when not set', async () => {
      const defaultConfigService = {
        get: jest.fn((key: string, defaultValue?: any) => defaultValue),
      } as any;

      const moduleRef = await Test.createTestingModule({
        providers: [
          SecurityService,
          { provide: LoggingService, useValue: loggingService },
          { provide: RateLimitService, useValue: rateLimitService },
          { provide: ConfigService, useValue: defaultConfigService },
          { provide: getRepositoryToken(IPBlock), useValue: ipRepo },
          { provide: REDIS_CLIENT, useValue: redis },
          { provide: WINSTON_MODULE_NEST_PROVIDER, useValue: { info: jest.fn(), warn: jest.fn() } },
          { provide: MetricsService, useValue: metricsService },
          { provide: UserServiceClient, useValue: userServiceClient },
        ],
      }).compile();

      const serviceWithDefaults = moduleRef.get(SecurityService);
      redis.get.mockResolvedValue(null);
      rateLimitService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 15,
        resetInSeconds: 60,
      });

      const result = await serviceWithDefaults.checkLoginSecurity({
        userId: 'user1',
        ip: '1.2.3.4',
        userAgent: 'test-agent',
      });

      expect(result.allowed).toBe(true);
      expect(defaultConfigService.get).toHaveBeenCalledWith('SECURITY_LOGIN_PER_MINUTE_IP', 20);
      expect(defaultConfigService.get).toHaveBeenCalledWith('SECURITY_LOGIN_PER_MINUTE_USER', 10);
    });

    it('should work without optional metrics service', async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          SecurityService,
          { provide: LoggingService, useValue: loggingService },
          { provide: RateLimitService, useValue: rateLimitService },
          { provide: ConfigService, useValue: configService },
          { provide: getRepositoryToken(IPBlock), useValue: ipRepo },
          { provide: REDIS_CLIENT, useValue: redis },
          { provide: WINSTON_MODULE_NEST_PROVIDER, useValue: { info: jest.fn(), warn: jest.fn() } },
          // No MetricsService provided
          { provide: UserServiceClient, useValue: userServiceClient },
        ],
      }).compile();

      const serviceWithoutMetrics = moduleRef.get(SecurityService);
      redis.get.mockResolvedValue(null);
      rateLimitService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 15,
        resetInSeconds: 60,
      });

      const result = await serviceWithoutMetrics.checkLoginSecurity({
        userId: 'user1',
        ip: '1.2.3.4',
        userAgent: 'test-agent',
      });

      expect(result.allowed).toBe(true);
      // Should not throw error even without metrics service
    });
  });
});
