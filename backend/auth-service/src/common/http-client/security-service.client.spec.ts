import { HttpService } from '@nestjs/axios';
import { SecurityServiceClient, SecurityEvent } from './security-service.client';

describe('SecurityServiceClient', () => {
    let client: SecurityServiceClient;
    let httpService: jest.Mocked<HttpService>;

    const mockSecurityEvent: SecurityEvent = {
        userId: 'user-123',
        type: 'USER_LOGIN',
        ipAddress: '127.0.0.1',
        timestamp: new Date(),
        metadata: { userAgent: 'Test Agent' },
    };

    beforeEach(async () => {
        const mockHttpService = {
            post: jest.fn(),
            get: jest.fn(),
        };

        const mockConfigService = {
            get: jest.fn().mockReturnValue('http://localhost:3010'),
        };

        // Создаем простой мок Circuit Breaker
        const mockCircuitBreaker = {
            fire: jest.fn(),
            opened: false,
            halfOpen: false,
            name: 'SecurityService',
            fallback: jest.fn(),
            on: jest.fn(),
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
            getSecurityServiceConfig: jest.fn().mockReturnValue({
                timeout: 5000,
                errorThresholdPercentage: 60,
                resetTimeout: 60000,
                rollingCountTimeout: 10000,
                rollingCountBuckets: 10,
                volumeThreshold: 5,
            }),
        };

        const mockLocalSecurityLogger = {
            logEventLocally: jest.fn().mockResolvedValue(undefined),
            checkSuspiciousActivityLocally: jest.fn().mockResolvedValue({ suspicious: false, reasons: [] }),
            getLocalEventsForUser: jest.fn().mockResolvedValue([]),
            getLocalSecurityStats: jest.fn().mockResolvedValue({
                totalEvents: 0,
                eventsByType: {},
                uniqueUsers: 0,
                uniqueIPs: 0,
                suspiciousActivities: 0,
                unprocessedEvents: 0,
            }),
            getQueueStats: jest.fn().mockReturnValue({
                queueSize: 0,
                maxQueueSize: 1000,
                unprocessedEvents: 0,
            }),
        };

        httpService = mockHttpService as any;
        
        client = new SecurityServiceClient(
            httpService,
            mockConfigService as any,
            mockCircuitBreakerService as any,
            mockCircuitBreakerConfig as any,
            mockLocalSecurityLogger as any
        );

        // Очищаем очередь событий после каждого теста
        client.clearQueue();
    });

    afterEach(() => {
        jest.clearAllMocks();
        client.clearQueue();
        // Очищаем ресурсы для предотвращения утечек памяти
        if (client && typeof client.onModuleDestroy === 'function') {
            client.onModuleDestroy();
        }
    });

    describe('logSecurityEvent', () => {
        it('should successfully log security event', async () => {
            // Arrange
            const mockResponse = { data: { success: true } };
            (client as any).circuitBreaker.fire.mockResolvedValue(mockResponse);

            // Act
            await client.logSecurityEvent(mockSecurityEvent);

            // Assert
            expect((client as any).circuitBreaker.fire).toHaveBeenCalledWith(
                'POST',
                '/security/events',
                mockSecurityEvent,
                undefined
            );
        });

        it('should handle errors gracefully and not throw', async () => {
            // Arrange
            (client as any).circuitBreaker.fire.mockRejectedValue(new Error('Network error'));

            // Act & Assert - should not throw
            await expect(client.logSecurityEvent(mockSecurityEvent)).resolves.toBeUndefined();
        });
    });

    describe('checkSuspiciousActivity', () => {
        it('should return suspicious activity result', async () => {
            // Arrange
            const mockResponse = { data: { suspicious: true, riskScore: 85 } };
            (client as any).circuitBreaker.fire.mockResolvedValue(mockResponse);

            // Act
            const result = await client.checkSuspiciousActivity('user-123', '127.0.0.1');

            // Assert
            expect(result).toBe(true);
            expect((client as any).circuitBreaker.fire).toHaveBeenCalledWith(
                'GET',
                '/security/check-suspicious',
                undefined,
                { params: { userId: 'user-123', ipAddress: '127.0.0.1' } }
            );
        });

        it('should return false on errors (fail open)', async () => {
            // Arrange
            (client as any).circuitBreaker.fire.mockRejectedValue(new Error('Network error'));

            // Act
            const result = await client.checkSuspiciousActivity('user-123', '127.0.0.1');

            // Assert
            expect(result).toBe(false);
        });
    });

    describe('logFailedLoginAttempt', () => {
        it('should log failed login attempt with correct event structure', async () => {
            // Arrange
            const mockResponse = { data: { success: true } };
            (client as any).circuitBreaker.fire.mockResolvedValue(mockResponse);

            // Act
            await client.logFailedLoginAttempt(
                'test@example.com',
                '127.0.0.1',
                'Invalid credentials',
                { userAgent: 'Test Agent' }
            );

            // Assert
            expect((client as any).circuitBreaker.fire).toHaveBeenCalledWith(
                'POST',
                '/security/events',
                expect.objectContaining({
                    userId: 'unknown',
                    type: 'FAILED_LOGIN',
                    ipAddress: '127.0.0.1',
                    metadata: {
                        email: 'test@example.com',
                        reason: 'Invalid credentials',
                        userAgent: 'Test Agent',
                    },
                }),
                undefined
            );
        });
    });

    describe('logPasswordChange', () => {
        it('should log password change event', async () => {
            // Arrange
            const mockResponse = { data: { success: true } };
            (client as any).circuitBreaker.fire.mockResolvedValue(mockResponse);

            // Act
            await client.logPasswordChange('user-123', '127.0.0.1', { reason: 'user_requested' });

            // Assert
            expect((client as any).circuitBreaker.fire).toHaveBeenCalledWith(
                'POST',
                '/security/events',
                expect.objectContaining({
                    userId: 'user-123',
                    type: 'PASSWORD_CHANGE',
                    ipAddress: '127.0.0.1',
                    metadata: { reason: 'user_requested' },
                }),
                undefined
            );
        });
    });

    describe('logTokenRefresh', () => {
        it('should log token refresh event', async () => {
            // Arrange
            const mockResponse = { data: { success: true } };
            (client as any).circuitBreaker.fire.mockResolvedValue(mockResponse);

            // Act
            await client.logTokenRefresh('user-123', '127.0.0.1', { tokenRotated: true });

            // Assert
            expect((client as any).circuitBreaker.fire).toHaveBeenCalledWith(
                'POST',
                '/security/events',
                expect.objectContaining({
                    userId: 'user-123',
                    type: 'TOKEN_REFRESH',
                    ipAddress: '127.0.0.1',
                    metadata: { tokenRotated: true },
                }),
                undefined
            );
        });
    });

    describe('queue management', () => {
        it('should provide queue statistics', () => {
            // Act
            const stats = client.getQueueStats();

            // Assert
            expect(stats).toHaveProperty('queueSize');
            expect(stats).toHaveProperty('maxQueueSize');
            expect(stats).toHaveProperty('circuitBreakerState');
            expect(stats.queueSize).toBe(0);
        });

        it('should clear queue', () => {
            // Act
            client.clearQueue();

            // Assert
            const stats = client.getQueueStats();
            expect(stats.queueSize).toBe(0);
        });
    });

    describe('Circuit Breaker integration', () => {
        it('should be configured with correct service name', () => {
            // Assert
            expect((client as any).circuitBreaker.name).toBe('SecurityService');
        });

        it('should provide circuit breaker state', () => {
            // Act
            const state = client.getCircuitBreakerState();

            // Assert
            expect(['CLOSED', 'OPEN', 'HALF_OPEN']).toContain(state);
        });
    });
});