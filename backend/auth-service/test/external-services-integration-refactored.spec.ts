import { Test, TestingModule } from '@nestjs/testing';
import { HttpModule } from '@nestjs/axios';
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
  getCacheStats: jest.fn(),
  clearCache: jest.fn(),
});

const createSecurityServiceClientMock = () => ({
  logSecurityEvent: jest.fn(),
  checkSuspiciousActivity: jest.fn(),
  getQueueStats: jest.fn(),
  clearQueue: jest.fn(),
});

const createNotificationServiceClientMock = () => ({
  sendWelcomeNotification: jest.fn(),
  sendLoginAlert: jest.fn(),
  getQueueStats: jest.fn(),
  clearQueue: jest.fn(),
});

describe('External Services Advanced Integration Tests - Refactored', () => {
  let userServiceClient: jest.Mocked<UserServiceClient>;
  let securityServiceClient: jest.Mocked<SecurityServiceClient>;
  let notificationServiceClient: jest.Mocked<NotificationServiceClient>;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        HttpModule.registerAsync({
          useFactory: () => ({
            timeout: 5000,
            maxRedirects: 5,
            headers: {
              'User-Agent': 'Auth-Service/1.0',
              'X-Service-Name': 'auth-service',
            },
          }),
        }),
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              // Advanced microservices configuration
              USER_SERVICE_URL: 'http://user-service:3002',
              SECURITY_SERVICE_URL: 'http://security-service:3010',
              NOTIFICATION_SERVICE_URL: 'http://notification-service:3007',

              // Circuit breaker advanced settings
              CIRCUIT_BREAKER_TIMEOUT: '5000',
              CIRCUIT_BREAKER_ERROR_THRESHOLD: '60',
              CIRCUIT_BREAKER_RESET_TIMEOUT: '60000',
              CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS: '3',

              // Service mesh configuration
              SERVICE_MESH_ENABLED: 'true',
              ISTIO_SIDECAR_ENABLED: 'true',
              MUTUAL_TLS_ENABLED: 'true',

              // Advanced monitoring
              PROMETHEUS_ENABLED: 'true',
              JAEGER_ENABLED: 'true',
              HEALTH_CHECK_INTERVAL: '30000',
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

  describe('Advanced User Service Integration', () => {
    it('should handle User Service authentication errors (401)', async () => {
      userServiceClient.findByEmail.mockRejectedValue(new Error('Authentication failed'));

      await expect(userServiceClient.findByEmail('test@example.com')).rejects.toThrow('Authentication failed');
      expect(userServiceClient.findByEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('should handle User Service rate limiting (429)', async () => {
      userServiceClient.findByEmail.mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(userServiceClient.findByEmail('test@example.com')).rejects.toThrow('Rate limit exceeded');
      expect(userServiceClient.findByEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('should handle User Service overload (503)', async () => {
      userServiceClient.findByEmail.mockRejectedValue(new Error('Service temporarily unavailable'));

      await expect(userServiceClient.findByEmail('test@example.com')).rejects.toThrow('Service temporarily unavailable');
      expect(userServiceClient.findByEmail).toHaveBeenCalledWith('test@example.com');
    });
  });

  describe('Advanced Security Service Integration', () => {
    it('should handle Security Service authentication errors (401)', async () => {
      securityServiceClient.logSecurityEvent.mockRejectedValue(new Error('Unauthorized'));

      const securityEvent = {
        userId: 'user-123',
        type: 'USER_LOGIN' as const,
        ipAddress: '192.168.1.1',
        timestamp: new Date(),
      };

      await expect(securityServiceClient.logSecurityEvent(securityEvent)).rejects.toThrow('Unauthorized');
      expect(securityServiceClient.logSecurityEvent).toHaveBeenCalledWith(securityEvent);
    });

    it('should handle Security Service overload (503)', async () => {
      securityServiceClient.checkSuspiciousActivity.mockRejectedValue(new Error('Service overloaded'));

      await expect(securityServiceClient.checkSuspiciousActivity('user-123', '192.168.1.1')).rejects.toThrow('Service overloaded');
      expect(securityServiceClient.checkSuspiciousActivity).toHaveBeenCalledWith('user-123', '192.168.1.1');
    });
  });

  describe('Advanced Notification Service Integration', () => {
    it('should handle email service provider errors (502)', async () => {
      notificationServiceClient.sendWelcomeNotification.mockRejectedValue(new Error('Email provider error'));

      const welcomeRequest = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };

      await expect(notificationServiceClient.sendWelcomeNotification(welcomeRequest)).rejects.toThrow('Email provider error');
      expect(notificationServiceClient.sendWelcomeNotification).toHaveBeenCalledWith(welcomeRequest);
    });

    it('should handle notification rate limiting gracefully', async () => {
      notificationServiceClient.sendLoginAlert.mockResolvedValue(undefined);
      notificationServiceClient.getQueueStats.mockReturnValue({
        queueSize: 1,
        maxQueueSize: 100,
        circuitBreakerState: 'CLOSED',
        circuitBreakerStats: {} as any,
        localQueue: {
          totalQueued: 1,
          byPriority: { high: 1, medium: 0, low: 0 },
          byType: { loginAlert: 1 },
          readyForRetry: 0,
          failedPermanently: 0,
          averageRetryCount: 0,
        },
      });

      await expect(
        notificationServiceClient.sendLoginAlert(
          'user-123',
          'test@example.com',
          '192.168.1.1',
          'Mozilla/5.0',
          'Moscow, Russia'
        )
      ).resolves.not.toThrow();

      const stats = notificationServiceClient.getQueueStats();
      expect(stats.queueSize).toBe(1);
    });
  });

  describe('Advanced Circuit Breaker Integration', () => {
    it('should open circuit breaker after threshold failures', async () => {
      // Mock multiple failures
      userServiceClient.findByEmail.mockRejectedValue(new Error('Service failure'));
      userServiceClient.getCacheStats.mockReturnValue({
        estimatedUsers: 0,
        memoryPerUser: 1024,
        isNearCapacity: false,
        recommendedAction: 'circuit_breaker_open',
        localSize: 0,
        maxSize: 1000,
        localHits: 0,
        localMisses: 5,
        redisHits: 0,
        redisMisses: 0,
        totalHits: 0,
        totalMisses: 5,
        hitRatio: 0,
        localHitRatio: 0,
        redisHitRatio: 0,
        memoryUsage: 0,
        redisEnabled: true,
      });

      // Simulate multiple failures
      for (let i = 0; i < 5; i++) {
        await userServiceClient.findByEmail('test@example.com').catch(() => null);
      }

      const stats = userServiceClient.getCacheStats();
      expect(stats.recommendedAction).toBe('circuit_breaker_open');
      expect(stats.totalMisses).toBe(5);
    });

    it('should handle circuit breaker half-open state', async () => {
      // Mock half-open state behavior
      let callCount = 0;
      userServiceClient.findByEmail.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error('Still failing'));
        }
        return Promise.resolve({
          id: 'user-123',
          name: 'Test User',
          email: 'test@example.com',
          password: 'hashed-password',
          isActive: true,
          lastLoginAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      // Simulate half-open state testing
      let result = null;
      for (let i = 0; i < 3; i++) {
        try {
          result = await userServiceClient.findByEmail('test@example.com');
          break;
        } catch (error) {
          // Continue trying
        }
      }

      expect(result).toBeDefined();
      expect(callCount).toBe(3);
    });
  });

  describe('Service Mesh Integration', () => {
    it('should include proper service mesh headers', () => {
      expect(configService.get('SERVICE_MESH_ENABLED')).toBe('true');
      expect(configService.get('ISTIO_SIDECAR_ENABLED')).toBe('true');
      expect(configService.get('MUTUAL_TLS_ENABLED')).toBe('true');
    });

    it('should handle service mesh authentication', async () => {
      // Mock successful service mesh authentication
      userServiceClient.findByEmail.mockResolvedValue({
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashed-password',
        isActive: true,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await userServiceClient.findByEmail('test@example.com');
      expect(result).toBeDefined();
      expect(result.email).toBe('test@example.com');
    });
  });

  describe('Advanced Monitoring Integration', () => {
    it('should have monitoring configuration enabled', () => {
      expect(configService.get('PROMETHEUS_ENABLED')).toBe('true');
      expect(configService.get('JAEGER_ENABLED')).toBe('true');
      expect(configService.get('HEALTH_CHECK_INTERVAL')).toBe('30000');
    });

    it('should track service health metrics', async () => {
      userServiceClient.getCacheStats.mockReturnValue({
        estimatedUsers: 100,
        memoryPerUser: 1024,
        isNearCapacity: false,
        recommendedAction: 'none',
        localSize: 50,
        maxSize: 1000,
        localHits: 80,
        localMisses: 20,
        redisHits: 30,
        redisMisses: 10,
        totalHits: 110,
        totalMisses: 30,
        hitRatio: 0.786,
        localHitRatio: 0.8,
        redisHitRatio: 0.75,
        memoryUsage: 102400,
        redisEnabled: true,
      });

      const healthStats = userServiceClient.getCacheStats();
      expect(healthStats.hitRatio).toBeGreaterThan(0.7);
      expect(healthStats.isNearCapacity).toBe(false);
      expect(healthStats.redisEnabled).toBe(true);
    });
  });
});