import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosResponse } from 'axios';
import { NotificationServiceClient, WelcomeNotificationRequest, SecurityAlertNotificationRequest } from './notification-service.client';
import { CircuitBreakerService } from '../circuit-breaker/circuit-breaker.service';
import { CircuitBreakerConfig } from '../circuit-breaker/circuit-breaker.config';
import { ServiceUnavailableError } from '../circuit-breaker/base-circuit-breaker.client';

describe('NotificationServiceClient', () => {
    let client: NotificationServiceClient;
    let configService: jest.Mocked<ConfigService>;
    let circuitBreakerConfig: jest.Mocked<CircuitBreakerConfig>;

    const mockCircuitBreaker = {
        fire: jest.fn(),
        opened: false,
        halfOpen: false,
        name: 'NotificationService',
        fallback: jest.fn(),
    };

    beforeEach(async () => {
        const mockHttpService = {
            post: jest.fn(),
            get: jest.fn(),
        };

        const mockConfigService = {
            get: jest.fn(),
        };

        const mockCircuitBreakerService = {
            createCircuitBreaker: jest.fn().mockReturnValue(mockCircuitBreaker),
            getCircuitBreakerStats: jest.fn(),
        };

        const mockCircuitBreakerConfig = {
            getNotificationServiceConfig: jest.fn().mockReturnValue({
                timeout: 5000,
                errorThresholdPercentage: 70,
                resetTimeout: 60000,
                rollingCountTimeout: 10000,
                rollingCountBuckets: 10,
                volumeThreshold: 3,
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                NotificationServiceClient,
                { provide: HttpService, useValue: mockHttpService },
                { provide: ConfigService, useValue: mockConfigService },
                { provide: CircuitBreakerService, useValue: mockCircuitBreakerService },
                { provide: CircuitBreakerConfig, useValue: mockCircuitBreakerConfig },
            ],
        }).compile();

        client = module.get<NotificationServiceClient>(NotificationServiceClient);
        configService = module.get(ConfigService);
        circuitBreakerConfig = module.get(CircuitBreakerConfig);

        // Setup default config mock
        configService.get.mockImplementation((key: string, defaultValue?: any) => {
            if (key === 'NOTIFICATION_SERVICE_URL') {
                return 'http://localhost:3007';
            }
            return defaultValue;
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
        client.clearQueue();
    });

    describe('sendWelcomeNotification', () => {
        const welcomeRequest: WelcomeNotificationRequest = {
            userId: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            language: 'ru',
        };

        it('should send welcome notification successfully', async () => {
            const mockResponse: AxiosResponse = {
                data: { success: true, notificationId: 'notif-123' },
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {} as any,
            };

            mockCircuitBreaker.fire.mockResolvedValue(mockResponse);

            await client.sendWelcomeNotification(welcomeRequest);

            expect(mockCircuitBreaker.fire).toHaveBeenCalledWith(
                'POST',
                '/notifications/welcome',
                expect.objectContaining({
                    userId: welcomeRequest.userId,
                    email: welcomeRequest.email,
                    name: welcomeRequest.name,
                    language: welcomeRequest.language,
                    timestamp: expect.any(Date),
                }),
                undefined
            );
        });

        it('should queue notification when service is unavailable', async () => {
            mockCircuitBreaker.fire.mockRejectedValue(new ServiceUnavailableError('Service unavailable'));

            await client.sendWelcomeNotification(welcomeRequest);

            const stats = client.getQueueStats();
            expect(stats.queueSize).toBe(1);
        });

        it('should queue notification on other errors', async () => {
            mockCircuitBreaker.fire.mockRejectedValue(new Error('Network error'));

            await client.sendWelcomeNotification(welcomeRequest);

            const stats = client.getQueueStats();
            expect(stats.queueSize).toBe(1);
        });

        it('should not throw error when notification fails', async () => {
            mockCircuitBreaker.fire.mockRejectedValue(new Error('Network error'));

            await expect(client.sendWelcomeNotification(welcomeRequest)).resolves.toBeUndefined();
        });
    });

    describe('sendSecurityAlert', () => {
        const securityAlertRequest: SecurityAlertNotificationRequest = {
            userId: 'user-123',
            email: 'test@example.com',
            alertType: 'suspicious_login',
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
            location: 'Moscow, Russia',
            timestamp: new Date(),
        };

        it('should send security alert successfully', async () => {
            const mockResponse: AxiosResponse = {
                data: { success: true, notificationId: 'alert-123' },
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {} as any,
            };

            mockCircuitBreaker.fire.mockResolvedValue(mockResponse);

            await client.sendSecurityAlert(
                securityAlertRequest.userId,
                securityAlertRequest.email,
                securityAlertRequest.alertType,
                {
                    ipAddress: securityAlertRequest.ipAddress,
                    userAgent: securityAlertRequest.userAgent,
                    location: securityAlertRequest.location,
                    timestamp: securityAlertRequest.timestamp,
                }
            );

            expect(mockCircuitBreaker.fire).toHaveBeenCalledWith(
                'POST',
                '/notifications/security-alert',
                expect.objectContaining({
                    userId: securityAlertRequest.userId,
                    email: securityAlertRequest.email,
                    alertType: securityAlertRequest.alertType,
                    ipAddress: securityAlertRequest.ipAddress,
                    userAgent: securityAlertRequest.userAgent,
                    location: securityAlertRequest.location,
                    timestamp: securityAlertRequest.timestamp,
                }),
                undefined
            );
        });

        it('should queue security alert when service is unavailable', async () => {
            mockCircuitBreaker.fire.mockRejectedValue(new ServiceUnavailableError('Service unavailable'));

            await client.sendSecurityAlert(
                securityAlertRequest.userId,
                securityAlertRequest.email,
                securityAlertRequest.alertType,
                {
                    ipAddress: securityAlertRequest.ipAddress,
                    userAgent: securityAlertRequest.userAgent,
                    location: securityAlertRequest.location,
                    timestamp: securityAlertRequest.timestamp,
                }
            );

            const stats = client.getQueueStats();
            expect(stats.queueSize).toBe(1);
        });
    });

    describe('sendLoginAlert', () => {
        it('should send login alert with correct parameters', async () => {
            const mockResponse: AxiosResponse = {
                data: { success: true, notificationId: 'login-alert-123' },
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {} as any,
            };

            mockCircuitBreaker.fire.mockResolvedValue(mockResponse);

            await client.sendLoginAlert(
                'user-123',
                'test@example.com',
                '192.168.1.1',
                'Mozilla/5.0',
                'Moscow, Russia'
            );

            expect(mockCircuitBreaker.fire).toHaveBeenCalledWith(
                'POST',
                '/notifications/security-alert',
                expect.objectContaining({
                    userId: 'user-123',
                    email: 'test@example.com',
                    alertType: 'suspicious_login',
                    ipAddress: '192.168.1.1',
                    userAgent: 'Mozilla/5.0',
                    location: 'Moscow, Russia',
                    timestamp: expect.any(Date),
                }),
                undefined
            );
        });
    });

    describe('sendPasswordChangeAlert', () => {
        it('should send password change alert with correct parameters', async () => {
            const mockResponse: AxiosResponse = {
                data: { success: true, notificationId: 'pwd-change-123' },
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {} as any,
            };

            mockCircuitBreaker.fire.mockResolvedValue(mockResponse);

            await client.sendPasswordChangeAlert(
                'user-123',
                'test@example.com',
                '192.168.1.1',
                'Mozilla/5.0'
            );

            expect(mockCircuitBreaker.fire).toHaveBeenCalledWith(
                'POST',
                '/notifications/security-alert',
                expect.objectContaining({
                    userId: 'user-123',
                    email: 'test@example.com',
                    alertType: 'password_change',
                    ipAddress: '192.168.1.1',
                    userAgent: 'Mozilla/5.0',
                    timestamp: expect.any(Date),
                }),
                undefined
            );
        });
    });

    describe('sendAccountLockedAlert', () => {
        it('should send account locked alert with correct parameters', async () => {
            const mockResponse: AxiosResponse = {
                data: { success: true, notificationId: 'locked-123' },
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {} as any,
            };

            mockCircuitBreaker.fire.mockResolvedValue(mockResponse);

            await client.sendAccountLockedAlert(
                'user-123',
                'test@example.com',
                'Multiple failed attempts',
                '192.168.1.1'
            );

            expect(mockCircuitBreaker.fire).toHaveBeenCalledWith(
                'POST',
                '/notifications/security-alert',
                expect.objectContaining({
                    userId: 'user-123',
                    email: 'test@example.com',
                    alertType: 'account_locked',
                    ipAddress: '192.168.1.1',
                    timestamp: expect.any(Date),
                }),
                undefined
            );
        });
    });

    describe('sendMultipleFailedAttemptsAlert', () => {
        it('should send multiple failed attempts alert with correct parameters', async () => {
            const mockResponse: AxiosResponse = {
                data: { success: true, notificationId: 'failed-attempts-123' },
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {} as any,
            };

            mockCircuitBreaker.fire.mockResolvedValue(mockResponse);

            await client.sendMultipleFailedAttemptsAlert(
                'test@example.com',
                5,
                '192.168.1.1',
                'user-123'
            );

            expect(mockCircuitBreaker.fire).toHaveBeenCalledWith(
                'POST',
                '/notifications/security-alert',
                expect.objectContaining({
                    userId: 'user-123',
                    email: 'test@example.com',
                    alertType: 'multiple_failed_attempts',
                    ipAddress: '192.168.1.1',
                    timestamp: expect.any(Date),
                }),
                undefined
            );
        });

        it('should handle unknown userId for failed attempts', async () => {
            const mockResponse: AxiosResponse = {
                data: { success: true, notificationId: 'failed-attempts-123' },
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {} as any,
            };

            mockCircuitBreaker.fire.mockResolvedValue(mockResponse);

            await client.sendMultipleFailedAttemptsAlert(
                'test@example.com',
                5,
                '192.168.1.1'
            );

            expect(mockCircuitBreaker.fire).toHaveBeenCalledWith(
                'POST',
                '/notifications/security-alert',
                expect.objectContaining({
                    userId: 'unknown',
                    email: 'test@example.com',
                    alertType: 'multiple_failed_attempts',
                    ipAddress: '192.168.1.1',
                    timestamp: expect.any(Date),
                }),
                undefined
            );
        });
    });

    describe('queue management', () => {
        it('should get queue statistics', () => {
            const stats = client.getQueueStats();

            expect(stats).toEqual({
                queueSize: 0,
                maxQueueSize: 500,
                circuitBreakerState: 'CLOSED',
                circuitBreakerStats: undefined,
            });
        });

        it('should clear queue', async () => {
            // Add some items to queue first
            mockCircuitBreaker.fire.mockRejectedValue(new Error('Network error'));

            const welcomeRequest: WelcomeNotificationRequest = {
                userId: 'user-123',
                email: 'test@example.com',
            };

            await client.sendWelcomeNotification(welcomeRequest);

            let stats = client.getQueueStats();
            expect(stats.queueSize).toBe(1);

            client.clearQueue();

            stats = client.getQueueStats();
            expect(stats.queueSize).toBe(0);
        });

        it('should limit queue size and remove oldest items', async () => {
            mockCircuitBreaker.fire.mockRejectedValue(new Error('Network error'));

            // Mock maxQueueSize to be smaller for testing
            (client as any).maxQueueSize = 2;

            const welcomeRequest: WelcomeNotificationRequest = {
                userId: 'user-123',
                email: 'test@example.com',
            };

            // Add 3 notifications to exceed queue size
            await client.sendWelcomeNotification({ ...welcomeRequest, email: 'test1@example.com' });
            await client.sendWelcomeNotification({ ...welcomeRequest, email: 'test2@example.com' });
            await client.sendWelcomeNotification({ ...welcomeRequest, email: 'test3@example.com' });

            const stats = client.getQueueStats();
            expect(stats.queueSize).toBe(2); // Should be limited to maxQueueSize
        });
    });

    describe('circuit breaker integration', () => {
        it('should get circuit breaker state', () => {
            mockCircuitBreaker.opened = false;
            mockCircuitBreaker.halfOpen = false;

            expect(client.getCircuitBreakerState()).toBe('CLOSED');
        });

        it('should detect open circuit breaker', () => {
            mockCircuitBreaker.opened = true;

            expect(client.isCircuitBreakerOpen()).toBe(true);
        });

        it('should detect half-open circuit breaker', () => {
            mockCircuitBreaker.halfOpen = true;

            expect(client.isCircuitBreakerHalfOpen()).toBe(true);
        });
    });

    describe('cleanup', () => {
        it('should cleanup resources on module destroy', () => {
            const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

            client.onModuleDestroy();

            expect(clearIntervalSpy).toHaveBeenCalled();
        });
    });
});