import { Test } from '@nestjs/testing';
import { RateLimitService } from './rate-limit.service';
import { SecurityService } from './security.service';
import { LoggingService } from '../logs/logging.service';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IPBlock } from '../../entities/ip-block.entity';
import { SecurityEvent } from '../../entities/security-event.entity';
import { REDIS_CLIENT } from '../../redis/redis.constants';
import { Repository } from 'typeorm';

describe('RateLimitService Integration', () => {
    let rateLimitService: RateLimitService;
    let securityService: SecurityService;
    let redis: any;

    beforeEach(async () => {
        // Mock Redis client
        const createMultiMock = () => ({
            get: jest.fn().mockReturnThis(),
            incr: jest.fn().mockReturnThis(),
            ttl: jest.fn().mockReturnThis(),
            expire: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue([[null, 0], [null, 1], [null, -1]]),
        });

        redis = {
            get: jest.fn().mockResolvedValue(null),
            incr: jest.fn().mockResolvedValue(1),
            ttl: jest.fn().mockResolvedValue(-1),
            expire: jest.fn().mockResolvedValue(1),
            del: jest.fn().mockResolvedValue(1),
            multi: jest.fn(() => createMultiMock()),
        };

        const moduleRef = await Test.createTestingModule({
            providers: [
                RateLimitService,
                SecurityService,
                {
                    provide: LoggingService,
                    useValue: { logSecurityEvent: jest.fn() },
                },
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string, defaultValue?: any) => {
                            const config: Record<string, any> = {
                                SECURITY_LOGIN_PER_MINUTE_IP: 20,
                                SECURITY_LOGIN_PER_MINUTE_USER: 10,
                                SECURITY_TXN_PER_MINUTE_USER: 5,
                                SECURITY_TXN_AMOUNT_THRESHOLD: 10000,
                                SECURITY_ACTIVITY_PER_MINUTE: 60,
                            };
                            return config[key] ?? defaultValue;
                        }),
                    },
                },
                {
                    provide: getRepositoryToken(IPBlock),
                    useClass: Repository,
                },
                {
                    provide: getRepositoryToken(SecurityEvent),
                    useClass: Repository,
                },
                {
                    provide: REDIS_CLIENT,
                    useValue: redis,
                },
            ],
        }).compile();

        rateLimitService = moduleRef.get(RateLimitService);
        securityService = moduleRef.get(SecurityService);
    });

    it('should integrate rate limiting with security checks', async () => {
        // Test that SecurityService uses RateLimitService correctly
        const loginDto = {
            userId: 'user123',
            ip: '192.168.1.1',
            userAgent: 'test-agent',
        };

        // Mock successful rate limit check
        redis.multi.mockReturnValue({
            get: jest.fn().mockReturnThis(),
            incr: jest.fn().mockReturnThis(),
            ttl: jest.fn().mockReturnThis(),
            expire: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue([[null, 0], [null, 1], [null, 60]]),
        });

        const result = await securityService.checkLoginSecurity(loginDto);

        expect(result).toBeDefined();
        expect(result.allowed).toBeDefined();
        expect(result.riskScore).toBeDefined();
    });

    it('should handle rate limit exceeded in security service', async () => {
        const loginDto = {
            userId: 'user123',
            ip: '192.168.1.1',
            userAgent: 'test-agent',
        };

        // Mock rate limit exceeded
        redis.multi.mockReturnValue({
            get: jest.fn().mockReturnThis(),
            incr: jest.fn().mockReturnThis(),
            ttl: jest.fn().mockReturnThis(),
            expire: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue([[null, 0], [null, 25], [null, 60]]), // 25 > 20 limit
        });

        const result = await securityService.checkLoginSecurity(loginDto);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Rate limit exceeded');
        expect(result.riskScore).toBeGreaterThanOrEqual(85);
    });

    it('should reset rate limits correctly', async () => {
        const key = 'test:reset:integration';

        await rateLimitService.resetRateLimit(key);

        expect(redis.del).toHaveBeenCalledWith(key);
        expect(redis.del).toHaveBeenCalledWith(`${key}:penalty`);
    });

    it('should handle exponential backoff for repeated violations', async () => {
        const key = 'test:backoff';
        const limit = 1;
        const window = 10;

        // Mock first violation
        redis.multi.mockReturnValueOnce({
            get: jest.fn().mockReturnThis(),
            incr: jest.fn().mockReturnThis(),
            ttl: jest.fn().mockReturnThis(),
            expire: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue([[null, 0], [null, 2], [null, -1]]), // count = 2, exceeds limit = 1
        });

        redis.multi.mockReturnValueOnce({
            incr: jest.fn().mockReturnThis(),
            expire: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue([[null, 1], [null, 1], [null, 1]]),
        });

        const result = await rateLimitService.checkRateLimit(key, limit, window);

        expect(result.allowed).toBe(false);
        expect(result.resetInSeconds).toBe(20); // 10 * 2^1
    });
});