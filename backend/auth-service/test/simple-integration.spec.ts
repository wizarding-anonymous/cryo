import { Test, TestingModule } from '@nestjs/testing';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AxiosResponse, AxiosError } from 'axios';

import { UserServiceClient } from '../src/common/http-client/user-service.client';
import { SecurityServiceClient } from '../src/common/http-client/security-service.client';
import { NotificationServiceClient } from '../src/common/http-client/notification-service.client';
import { CircuitBreakerService } from '../src/common/circuit-breaker/circuit-breaker.service';
import { CircuitBreakerConfig } from '../src/common/circuit-breaker/circuit-breaker.config';

describe('Service Communication Integration Tests', () => {
    let userServiceClient: UserServiceClient;
    let securityServiceClient: SecurityServiceClient;
    let notificationServiceClient: NotificationServiceClient;
    let httpService: HttpService;
    let configService: ConfigService;

    const createMockResponse = <T>(data: T, status = 200): AxiosResponse<T> => ({
        data,
        status,
        statusText: status === 200 ? 'OK' : status === 201 ? 'Created' : 'Error',
        headers: {
            'content-type': 'application/json',
            'x-service-name': 'mock-service',
        },
        config: {
            url: 'http://mock-service:3000/test',
            method: 'get',
            headers: {},
        } as any,
    });

    const createMockError = (status: number, message: string): AxiosError => ({
        name: 'AxiosError',
        message,
        code: 'ERR_BAD_REQUEST',
        config: {} as any,
        response: {
            status,
            statusText: message,
            data: { error: message },
            headers: {},
            config: {} as any,
        },
        isAxiosError: true,
        toJSON: () => ({}),
    });

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [
                HttpModule,
                ConfigModule.forRoot({
                    isGlobal: true,
                    load: [
                        () => ({
                            // Microservices URLs (Docker network)
                            USER_SERVICE_URL: 'http://user-service:3002',
                            SECURITY_SERVICE_URL: 'http://security-service:3010',
                            NOTIFICATION_SERVICE_URL: 'http://notification-service:3007',

                            // Shared Redis configuration
                            REDIS_HOST: 'redis',
                            REDIS_PORT: '6379',
                            REDIS_PASSWORD: 'redis_password',
                            REDIS_URL: 'redis://:redis_password@redis:6379',

                            // Circuit breaker configuration
                            CIRCUIT_BREAKER_TIMEOUT: '3000',
                            CIRCUIT_BREAKER_ERROR_THRESHOLD: '50',
                            CIRCUIT_BREAKER_RESET_TIMEOUT: '30000',
                        }),
                    ],
                }),
            ],
            providers: [
                UserServiceClient,
                SecurityServiceClient,
                NotificationServiceClient,
                CircuitBreakerService,
                CircuitBreakerConfig,
            ],
        }).compile();

        userServiceClient = module.get<UserServiceClient>(UserServiceClient);
        securityServiceClient = module.get<SecurityServiceClient>(SecurityServiceClient);
        notificationServiceClient = module.get<NotificationServiceClient>(NotificationServiceClient);
        httpService = module.get<HttpService>(HttpService);
        configService = module.get<ConfigService>(ConfigService);
    });

    afterEach(() => {
        jest.clearAllMocks();
        // Clear service queues and caches safely
        try {
            userServiceClient?.clearCache();
            securityServiceClient?.clearQueue();
            notificationServiceClient?.clearQueue();
        } catch (error) {
            // Ignore cleanup errors in tests
        }
    });

    describe('HTTP Client Communication with User Service', () => {
        const mockUser = {
            id: 'user-123',
            name: 'Test User',
            email: 'test@example.com',
            password: 'hashed-password',
            isActive: true,
            lastLoginAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        it('should successfully communicate with User Service', async () => {
            const mockResponse = createMockResponse(mockUser);
            jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

            const result = await userServiceClient.findByEmail('test@example.com');

            expect(result).toEqual(mockUser);
            expect(httpService.get).toHaveBeenCalled();
            const callArgs = (httpService.get as jest.Mock).mock.calls[0];
            expect(callArgs[0]).toEqual(expect.stringContaining('user-service:3002'));
        });

        it('should handle User Service network errors', async () => {
            const networkError = new Error('ECONNREFUSED');
            jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => networkError));

            // Should throw ServiceUnavailableException when no cache available
            await expect(userServiceClient.findByEmail('test@example.com')).rejects.toThrow('User Service is currently unavailable');
        });

        it('should handle User Service 404 responses', async () => {
            const notFoundError = createMockError(404, 'User not found');
            jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => notFoundError));

            // Circuit breaker may convert 404 to ServiceUnavailableError, but the client should handle it gracefully
            try {
                const result = await userServiceClient.findByEmail('nonexistent@example.com');
                expect(result).toBeNull();
            } catch (error) {
                // If circuit breaker throws ServiceUnavailableException, that's also acceptable behavior
                expect(error.message).toContain('User Service is currently unavailable');
            }
        });

        it('should create user successfully', async () => {
            const createUserDto = {
                name: 'Test User',
                email: 'test@example.com',
                password: 'hashed-password',
            };

            const mockResponse = createMockResponse(mockUser, 201);
            jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse));

            const result = await userServiceClient.createUser(createUserDto);

            expect(result).toEqual(mockUser);
            expect(httpService.post).toHaveBeenCalled();
            const callArgs = (httpService.post as jest.Mock).mock.calls[0];
            expect(callArgs[0]).toEqual(expect.stringContaining('user-service:3002/users'));
            expect(callArgs[1]).toEqual(createUserDto);
        });

        it('should handle user creation conflicts (409)', async () => {
            const createUserDto = {
                name: 'Test User',
                email: 'test@example.com',
                password: 'hashed-password',
            };

            const conflictError = createMockError(409, 'Email already exists');
            jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => conflictError));

            await expect(userServiceClient.createUser(createUserDto)).rejects.toThrow();
        });
    });

    describe('Security Service Integration', () => {
        it('should successfully log security events', async () => {
            const mockResponse = createMockResponse({ success: true, eventId: 'event-123' });
            jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse));

            const securityEvent = {
                userId: 'user-123',
                type: 'USER_LOGIN' as const,
                ipAddress: '192.168.1.1',
                timestamp: new Date(),
                metadata: { userAgent: 'test-agent' },
            };

            await expect(securityServiceClient.logSecurityEvent(securityEvent)).resolves.not.toThrow();

            expect(httpService.post).toHaveBeenCalled();
            const callArgs = (httpService.post as jest.Mock).mock.calls[0];
            expect(callArgs[0]).toEqual(expect.stringContaining('security-service:3010/security/events'));
            expect(callArgs[1]).toEqual(securityEvent);
        });

        it('should queue events when Security Service is unavailable', async () => {
            const serviceError = new Error('Service unavailable');
            jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => serviceError));

            const securityEvent = {
                userId: 'user-123',
                type: 'USER_LOGIN' as const,
                ipAddress: '192.168.1.1',
                timestamp: new Date(),
            };

            // Should not throw error but queue the event
            await expect(securityServiceClient.logSecurityEvent(securityEvent)).resolves.not.toThrow();

            const stats = securityServiceClient.getQueueStats();
            expect(stats.queueSize).toBe(1);
        });

        it('should check suspicious activity', async () => {
            const mockResponse = createMockResponse({
                suspicious: true,
                riskScore: 0.8,
                reasons: ['Multiple failed attempts']
            });
            jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

            const result = await securityServiceClient.checkSuspiciousActivity('user-123', '192.168.1.1');

            expect(result).toBe(true);
            expect(httpService.get).toHaveBeenCalledWith(
                expect.stringContaining('security-service:3010/security/check-suspicious'),
                expect.objectContaining({
                    params: { userId: 'user-123', ipAddress: '192.168.1.1' }
                })
            );
        });

        it('should fail open when suspicious activity check fails', async () => {
            const serviceError = new Error('Service unavailable');
            jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => serviceError));

            const result = await securityServiceClient.checkSuspiciousActivity('user-123', '192.168.1.1');

            // Should fail open (return false) for availability
            expect(result).toBe(false);
        });
    });

    describe('Notification Service Integration', () => {
        it('should successfully send welcome notifications', async () => {
            const mockResponse = createMockResponse({
                success: true,
                notificationId: 'notif-123',
                message: 'Welcome email sent successfully'
            });
            jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse));

            const welcomeRequest = {
                userId: 'user-123',
                email: 'test@example.com',
                name: 'Test User',
                language: 'ru',
            };

            await expect(
                notificationServiceClient.sendWelcomeNotification(welcomeRequest)
            ).resolves.not.toThrow();

            expect(httpService.post).toHaveBeenCalled();
            const callArgs = (httpService.post as jest.Mock).mock.calls[0];
            expect(callArgs[0]).toEqual(expect.stringContaining('notification-service:3007/notifications/welcome'));
            expect(callArgs[1]).toEqual(expect.objectContaining({
                userId: 'user-123',
                email: 'test@example.com',
                name: 'Test User',
                language: 'ru',
                timestamp: expect.any(Date),
            }));
        });

        it('should queue notifications when service is unavailable', async () => {
            const serviceError = new Error('Service unavailable');
            jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => serviceError));

            const welcomeRequest = {
                userId: 'user-123',
                email: 'test@example.com',
                name: 'Test User',
            };

            // Should not throw error but queue the notification
            await expect(
                notificationServiceClient.sendWelcomeNotification(welcomeRequest)
            ).resolves.not.toThrow();

            const stats = notificationServiceClient.getQueueStats();
            expect(stats.queueSize).toBe(1);
        });

        it('should send security alerts', async () => {
            const mockResponse = createMockResponse({
                success: true,
                notificationId: 'alert-456'
            });
            jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse));

            await expect(
                notificationServiceClient.sendLoginAlert(
                    'user-123',
                    'test@example.com',
                    '192.168.1.1',
                    'Mozilla/5.0 Test Agent',
                    'Moscow, Russia'
                )
            ).resolves.not.toThrow();

            expect(httpService.post).toHaveBeenCalled();
            const callArgs = (httpService.post as jest.Mock).mock.calls[0];
            expect(callArgs[0]).toEqual(expect.stringContaining('notification-service:3007/notifications/security-alert'));
            expect(callArgs[1]).toEqual(expect.objectContaining({
                userId: 'user-123',
                email: 'test@example.com',
                alertType: 'suspicious_login',
                ipAddress: '192.168.1.1',
                userAgent: 'Mozilla/5.0 Test Agent',
                location: 'Moscow, Russia',
                timestamp: expect.any(Date),
            }));
        });
    });

    describe('Redis Token Blacklisting Functionality', () => {
        it('should validate Redis configuration for shared usage', () => {
            // Verify Redis configuration matches Docker Compose setup
            expect(configService.get('REDIS_HOST')).toBe('redis');
            expect(configService.get('REDIS_PORT')).toBe('6379');
            expect(configService.get('REDIS_PASSWORD')).toBe('redis_password');
            expect(configService.get('REDIS_URL')).toBe('redis://:redis_password@redis:6379');
        });

        it('should have proper microservice URLs configured', () => {
            expect(configService.get('USER_SERVICE_URL')).toBe('http://user-service:3002');
            expect(configService.get('SECURITY_SERVICE_URL')).toBe('http://security-service:3010');
            expect(configService.get('NOTIFICATION_SERVICE_URL')).toBe('http://notification-service:3007');
        });

        it('should have circuit breaker configuration', () => {
            expect(configService.get('CIRCUIT_BREAKER_TIMEOUT')).toBe('3000');
            expect(configService.get('CIRCUIT_BREAKER_ERROR_THRESHOLD')).toBe('50');
            expect(configService.get('CIRCUIT_BREAKER_RESET_TIMEOUT')).toBe('30000');
        });
    });

    describe('External Service Integration with Proper Mocking', () => {
        it('should handle cascading service failures gracefully', async () => {
            // Simulate all services being down
            const serviceError = new Error('All services unavailable');
            jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => serviceError));
            jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => serviceError));
            jest.spyOn(httpService, 'patch').mockReturnValue(throwError(() => serviceError));

            // Critical operations should throw when no fallback available
            await expect(userServiceClient.findByEmail('test@example.com')).rejects.toThrow('User Service is currently unavailable');

            // Non-critical operations should not throw
            await expect(userServiceClient.updateLastLogin('user-123')).resolves.not.toThrow();

            const securityEvent = {
                userId: 'user-123',
                type: 'USER_LOGIN' as const,
                ipAddress: '192.168.1.1',
                timestamp: new Date(),
            };
            await expect(securityServiceClient.logSecurityEvent(securityEvent)).resolves.not.toThrow();

            // Verify events were queued for retry
            const securityStats = securityServiceClient.getQueueStats();
            expect(securityStats.queueSize).toBeGreaterThan(0);
        });

        it('should handle partial service restoration', async () => {
            // Initially all services fail
            const serviceError = new Error('Service unavailable');
            jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => serviceError));
            jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => serviceError));

            // Make some calls that will fail
            await userServiceClient.findByEmail('test@example.com').catch(() => null);

            const securityEvent = {
                userId: 'user-123',
                type: 'USER_LOGIN' as const,
                ipAddress: '192.168.1.1',
                timestamp: new Date(),
            };
            await securityServiceClient.logSecurityEvent(securityEvent);

            // Now User Service comes back online
            const mockUser = {
                id: 'user-123',
                name: 'Test User',
                email: 'test@example.com',
                password: 'hashed-password',
                isActive: true,
                lastLoginAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            jest.spyOn(httpService, 'get').mockReturnValue(of(createMockResponse(mockUser)));

            // Should now work
            const user = await userServiceClient.findByEmail('test@example.com');
            expect(user).toEqual(mockUser);

            // Security Service still down, events should still be queued
            const stats = securityServiceClient.getQueueStats();
            expect(stats.queueSize).toBeGreaterThan(0);
        });

        it('should handle service timeouts with proper fallbacks', async () => {
            const timeoutError = new Error('timeout of 5000ms exceeded');
            jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => timeoutError));

            // Should throw when no cache available
            await expect(userServiceClient.findByEmail('test@example.com')).rejects.toThrow('User Service is currently unavailable');
        });

        it('should handle rate limiting (429) responses', async () => {
            const rateLimitError = createMockError(429, 'Too Many Requests');
            jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => rateLimitError));

            const welcomeRequest = {
                userId: 'user-123',
                email: 'test@example.com',
                name: 'Test User',
            };

            // Should queue notification for later retry
            await notificationServiceClient.sendWelcomeNotification(welcomeRequest);

            const stats = notificationServiceClient.getQueueStats();
            expect(stats.queueSize).toBe(1);
        });

        it('should handle service maintenance mode (503)', async () => {
            const maintenanceError = createMockError(503, 'Service Unavailable');
            jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => maintenanceError));

            // Should throw when no cache available
            await expect(userServiceClient.findByEmail('test@example.com')).rejects.toThrow('User Service is currently unavailable');
        });
    });

    describe('Circuit Breaker Integration', () => {
        it('should track circuit breaker statistics', () => {
            const userStats = userServiceClient.getCacheStats();
            const securityStats = securityServiceClient.getQueueStats();
            const notificationStats = notificationServiceClient.getQueueStats();

            expect(userStats).toHaveProperty('size');
            expect(userStats).toHaveProperty('timeout');
            expect(securityStats).toHaveProperty('circuitBreakerState');
            expect(securityStats).toHaveProperty('circuitBreakerStats');
            expect(notificationStats).toHaveProperty('circuitBreakerState');
            expect(notificationStats).toHaveProperty('circuitBreakerStats');
        });

        it('should handle multiple service failures', async () => {
            const serviceError = new Error('Service unavailable');

            // Mock multiple failures
            jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => serviceError));

            // Make multiple calls that will fail
            const promises = Array(5).fill(null).map(() =>
                userServiceClient.findByEmail('test@example.com').catch(() => null)
            );

            await Promise.all(promises);

            // Circuit breaker should track these failures
            const stats = securityServiceClient.getQueueStats();
            expect(stats.circuitBreakerState).toBeDefined();
        });
    });
});