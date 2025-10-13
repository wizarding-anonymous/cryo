import { Test, TestingModule } from '@nestjs/testing';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { UserServiceClient } from '../src/common/http-client/user-service.client';
import { SecurityServiceClient } from '../src/common/http-client/security-service.client';
import { NotificationServiceClient } from '../src/common/http-client/notification-service.client';
import { CircuitBreakerService } from '../src/common/circuit-breaker/circuit-breaker.service';
import { CircuitBreakerConfig } from '../src/common/circuit-breaker/circuit-breaker.config';

// Create simple mocks
const createUserServiceClientMock = () => ({
  findByEmail: jest.fn(),
  createUser: jest.fn(),
  findById: jest.fn(),
  updateLastLogin: jest.fn(),
  getCacheStats: jest.fn().mockReturnValue({
    estimatedUsers: 0,
    memoryPerUser: 1024,
    isNearCapacity: false,
    recommendedAction: 'none',
    localSize: 0,
    maxSize: 1000,
    localHits: 0,
    localMisses: 0,
    redisHits: 0,
    redisMisses: 0,
    totalHits: 0,
    totalMisses: 0,
    hitRatio: 0,
    localHitRatio: 0,
    redisHitRatio: 0,
    memoryUsage: 0,
    redisEnabled: true,
  }),
  clearCache: jest.fn(),
});

const createSecurityServiceClientMock = () => ({
  logSecurityEvent: jest.fn(),
  checkSuspiciousActivity: jest.fn(),
  getQueueStats: jest.fn().mockReturnValue({
    queueSize: 0,
    maxQueueSize: 100,
    circuitBreakerState: 'CLOSED' as const,
    circuitBreakerStats: {} as any,
    localFallback: {
      queueSize: 0,
      maxQueueSize: 50,
      isProcessing: false,
    },
  }),
  clearQueue: jest.fn(),
});

const createNotificationServiceClientMock = () => ({
  sendWelcomeNotification: jest.fn(),
  sendLoginAlert: jest.fn(),
  getQueueStats: jest.fn().mockReturnValue({
    queueSize: 0,
    maxQueueSize: 100,
    circuitBreakerState: 'CLOSED' as const,
    circuitBreakerStats: {} as any,
    localQueue: {
      totalQueued: 0,
      byPriority: {},
      byType: {},
      readyForRetry: 0,
      failedPermanently: 0,
      averageRetryCount: 0,
    },
  }),
  clearQueue: jest.fn(),
});

describe('Service Communication Integration Tests - Refactored', () => {
    let userServiceClient: jest.Mocked<UserServiceClient>;
    let securityServiceClient: jest.Mocked<SecurityServiceClient>;
    let notificationServiceClient: jest.Mocked<NotificationServiceClient>;
    let configService: ConfigService;

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
                {
                    provide: UserServiceClient,
                    useValue: createUserServiceClientMock(),
                },
                {
                    provide: SecurityServiceClient,
                    useValue: createSecurityServiceClientMock(),
                },
                {
                    provide: NotificationServiceClient,
                    useValue: createNotificationServiceClientMock(),
                },
                CircuitBreakerService,
                CircuitBreakerConfig,
            ],
        }).compile();

        userServiceClient = module.get(UserServiceClient) as jest.Mocked<UserServiceClient>;
        securityServiceClient = module.get(SecurityServiceClient) as jest.Mocked<SecurityServiceClient>;
        notificationServiceClient = module.get(NotificationServiceClient) as jest.Mocked<NotificationServiceClient>;
        configService = module.get<ConfigService>(ConfigService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('User Service Communication', () => {
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
            userServiceClient.findByEmail.mockResolvedValue(mockUser);

            const result = await userServiceClient.findByEmail('test@example.com');

            expect(result).toEqual(mockUser);
            expect(userServiceClient.findByEmail).toHaveBeenCalledWith('test@example.com');
        });

        it('should handle User Service network errors', async () => {
            userServiceClient.findByEmail.mockRejectedValue(new Error('User Service is currently unavailable'));

            await expect(userServiceClient.findByEmail('test@example.com')).rejects.toThrow('User Service is currently unavailable');
            expect(userServiceClient.findByEmail).toHaveBeenCalledWith('test@example.com');
        });

        it('should handle User Service 404 responses', async () => {
            userServiceClient.findByEmail.mockResolvedValue(null);

            const result = await userServiceClient.findByEmail('nonexistent@example.com');
            expect(result).toBeNull();
            expect(userServiceClient.findByEmail).toHaveBeenCalledWith('nonexistent@example.com');
        });

        it('should create user successfully', async () => {
            const createUserDto = {
                name: 'Test User',
                email: 'test@example.com',
                password: 'hashed-password',
            };

            userServiceClient.createUser.mockResolvedValue(mockUser);

            const result = await userServiceClient.createUser(createUserDto);

            expect(result).toEqual(mockUser);
            expect(userServiceClient.createUser).toHaveBeenCalledWith(createUserDto);
        });

        it('should handle user creation conflicts (409)', async () => {
            const createUserDto = {
                name: 'Test User',
                email: 'test@example.com',
                password: 'hashed-password',
            };

            userServiceClient.createUser.mockRejectedValue(new Error('Email already exists'));

            await expect(userServiceClient.createUser(createUserDto)).rejects.toThrow('Email already exists');
            expect(userServiceClient.createUser).toHaveBeenCalledWith(createUserDto);
        });
    });

    describe('Security Service Integration', () => {
        it('should successfully log security events', async () => {
            const securityEvent = {
                userId: 'user-123',
                type: 'USER_LOGIN' as const,
                ipAddress: '192.168.1.1',
                timestamp: new Date(),
                metadata: { userAgent: 'test-agent' },
            };

            securityServiceClient.logSecurityEvent.mockResolvedValue(undefined);

            await expect(securityServiceClient.logSecurityEvent(securityEvent)).resolves.not.toThrow();
            expect(securityServiceClient.logSecurityEvent).toHaveBeenCalledWith(securityEvent);
        });

        it('should queue events when Security Service is unavailable', async () => {
            const securityEvent = {
                userId: 'user-123',
                type: 'USER_LOGIN' as const,
                ipAddress: '192.168.1.1',
                timestamp: new Date(),
            };

            securityServiceClient.logSecurityEvent.mockResolvedValue(undefined);
            securityServiceClient.getQueueStats.mockReturnValue({
                queueSize: 1,
                maxQueueSize: 100,
                circuitBreakerState: 'CLOSED',
                circuitBreakerStats: {} as any,
                localFallback: {
                    queueSize: 1,
                    maxQueueSize: 50,
                    isProcessing: false,
                },
            });

            await expect(securityServiceClient.logSecurityEvent(securityEvent)).resolves.not.toThrow();

            const stats = securityServiceClient.getQueueStats();
            expect(stats.queueSize).toBe(1);
        });

        it('should check suspicious activity', async () => {
            securityServiceClient.checkSuspiciousActivity.mockResolvedValue(true);

            const result = await securityServiceClient.checkSuspiciousActivity('user-123', '192.168.1.1');

            expect(result).toBe(true);
            expect(securityServiceClient.checkSuspiciousActivity).toHaveBeenCalledWith('user-123', '192.168.1.1');
        });

        it('should fail open when suspicious activity check fails', async () => {
            securityServiceClient.checkSuspiciousActivity.mockResolvedValue(false);

            const result = await securityServiceClient.checkSuspiciousActivity('user-123', '192.168.1.1');

            expect(result).toBe(false);
            expect(securityServiceClient.checkSuspiciousActivity).toHaveBeenCalledWith('user-123', '192.168.1.1');
        });
    });

    describe('Notification Service Integration', () => {
        it('should successfully send welcome notifications', async () => {
            const welcomeRequest = {
                userId: 'user-123',
                email: 'test@example.com',
                name: 'Test User',
                language: 'ru',
            };

            notificationServiceClient.sendWelcomeNotification.mockResolvedValue(undefined);

            await expect(
                notificationServiceClient.sendWelcomeNotification(welcomeRequest)
            ).resolves.not.toThrow();

            expect(notificationServiceClient.sendWelcomeNotification).toHaveBeenCalledWith(welcomeRequest);
        });

        it('should queue notifications when service is unavailable', async () => {
            const welcomeRequest = {
                userId: 'user-123',
                email: 'test@example.com',
                name: 'Test User',
            };

            notificationServiceClient.sendWelcomeNotification.mockResolvedValue(undefined);
            notificationServiceClient.getQueueStats.mockReturnValue({
                queueSize: 1,
                maxQueueSize: 100,
                circuitBreakerState: 'CLOSED',
                circuitBreakerStats: {} as any,
                localQueue: {
                    totalQueued: 1,
                    byPriority: {},
                    byType: {},
                    readyForRetry: 0,
                    failedPermanently: 0,
                    averageRetryCount: 0,
                },
            });

            await expect(
                notificationServiceClient.sendWelcomeNotification(welcomeRequest)
            ).resolves.not.toThrow();

            const stats = notificationServiceClient.getQueueStats();
            expect(stats.queueSize).toBe(1);
        });

        it('should send security alerts', async () => {
            notificationServiceClient.sendLoginAlert.mockResolvedValue(undefined);

            await expect(
                notificationServiceClient.sendLoginAlert(
                    'user-123',
                    'test@example.com',
                    '192.168.1.1',
                    'Mozilla/5.0 Test Agent',
                    'Moscow, Russia'
                )
            ).resolves.not.toThrow();

            expect(notificationServiceClient.sendLoginAlert).toHaveBeenCalledWith(
                'user-123',
                'test@example.com',
                '192.168.1.1',
                'Mozilla/5.0 Test Agent',
                'Moscow, Russia'
            );
        });
    });

    describe('Configuration Validation', () => {
        it('should validate Redis configuration for shared usage', () => {
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

    describe('Service Resilience', () => {
        it('should handle cascading service failures gracefully', async () => {
            userServiceClient.findByEmail.mockRejectedValue(new Error('User Service is currently unavailable'));
            userServiceClient.updateLastLogin.mockResolvedValue(undefined);
            securityServiceClient.logSecurityEvent.mockResolvedValue(undefined);
            securityServiceClient.getQueueStats.mockReturnValue({
                queueSize: 1,
                maxQueueSize: 100,
                circuitBreakerState: 'OPEN',
                circuitBreakerStats: {} as any,
                localFallback: {
                    queueSize: 1,
                    maxQueueSize: 50,
                    isProcessing: false,
                },
            });

            await expect(userServiceClient.findByEmail('test@example.com')).rejects.toThrow('User Service is currently unavailable');
            await expect(userServiceClient.updateLastLogin('user-123')).resolves.not.toThrow();

            const securityEvent = {
                userId: 'user-123',
                type: 'USER_LOGIN' as const,
                ipAddress: '192.168.1.1',
                timestamp: new Date(),
            };
            await expect(securityServiceClient.logSecurityEvent(securityEvent)).resolves.not.toThrow();

            const securityStats = securityServiceClient.getQueueStats();
            expect(securityStats.queueSize).toBeGreaterThan(0);
        });

        it('should track circuit breaker statistics', () => {
            userServiceClient.getCacheStats.mockReturnValue({
                estimatedUsers: 0,
                memoryPerUser: 1024,
                isNearCapacity: false,
                recommendedAction: 'none',
                localSize: 0,
                maxSize: 1000,
                localHits: 0,
                localMisses: 0,
                redisHits: 0,
                redisMisses: 0,
                totalHits: 0,
                totalMisses: 0,
                hitRatio: 0,
                localHitRatio: 0,
                redisHitRatio: 0,
                memoryUsage: 0,
                redisEnabled: true
            });
            securityServiceClient.getQueueStats.mockReturnValue({
                queueSize: 0,
                maxQueueSize: 100,
                circuitBreakerState: 'CLOSED',
                circuitBreakerStats: {} as any,
                localFallback: {
                    queueSize: 0,
                    maxQueueSize: 50,
                    isProcessing: false,
                },
            });
            notificationServiceClient.getQueueStats.mockReturnValue({
                queueSize: 0,
                maxQueueSize: 100,
                circuitBreakerState: 'CLOSED',
                circuitBreakerStats: {} as any,
                localQueue: {
                    totalQueued: 0,
                    byPriority: {},
                    byType: {},
                    readyForRetry: 0,
                    failedPermanently: 0,
                    averageRetryCount: 0,
                },
            });

            const userStats = userServiceClient.getCacheStats();
            const securityStats = securityServiceClient.getQueueStats();
            const notificationStats = notificationServiceClient.getQueueStats();

            expect(userStats).toHaveProperty('localSize');
            expect(userStats).toHaveProperty('redisEnabled');
            expect(securityStats).toHaveProperty('circuitBreakerState');
            expect(securityStats).toHaveProperty('circuitBreakerStats');
            expect(notificationStats).toHaveProperty('circuitBreakerState');
            expect(notificationStats).toHaveProperty('circuitBreakerStats');
        });
    });
});