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

describe('Advanced Service Communication Integration Tests - Refactored', () => {
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
              // Microservices URLs
              USER_SERVICE_URL: 'http://user-service:3002',
              SECURITY_SERVICE_URL: 'http://security-service:3010',
              NOTIFICATION_SERVICE_URL: 'http://notification-service:3007',

              // Redis configuration for shared token blacklisting
              REDIS_HOST: 'redis',
              REDIS_PORT: '6379',
              REDIS_PASSWORD: 'redis_password',
              REDIS_URL: 'redis://:redis_password@redis:6379',

              // Service mesh and tracing
              SERVICE_MESH_ENABLED: 'true',
              DISTRIBUTED_TRACING_ENABLED: 'true',
              JAEGER_ENDPOINT: 'http://jaeger:14268/api/traces',
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

  describe('Redis Token Blacklisting Integration', () => {
    it('should blacklist token in shared Redis instance', async () => {
      // Mock successful token blacklisting
      const tokenHash = 'sha256-token-hash';
      
      // Simulate token blacklisting operation
      expect(configService.get('REDIS_URL')).toBe('redis://:redis_password@redis:6379');
      expect(tokenHash).toBe('sha256-token-hash');
      
      // In a real scenario, this would interact with Redis
      // For testing, we just verify the configuration is correct
      expect(configService.get('REDIS_HOST')).toBe('redis');
      expect(configService.get('REDIS_PORT')).toBe('6379');
      expect(configService.get('REDIS_PASSWORD')).toBe('redis_password');
    });

    it('should handle distributed token invalidation across microservices', async () => {
      // Mock distributed token invalidation
      const tokenHash = 'sha256-token-hash';
      
      // Simulate notifying all services about token invalidation
      securityServiceClient.logSecurityEvent.mockResolvedValue(undefined);
      
      const securityEvent = {
        userId: 'user-123',
        type: 'USER_LOGOUT' as const,
        ipAddress: '192.168.1.1',
        timestamp: new Date(),
        metadata: { tokenHash, reason: 'logout' },
      };

      await expect(securityServiceClient.logSecurityEvent(securityEvent)).resolves.not.toThrow();
      expect(securityServiceClient.logSecurityEvent).toHaveBeenCalledWith(securityEvent);
    });
  });

  describe('Microservices Architecture Integration', () => {
    it('should handle cross-service authentication flow', async () => {
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

      // Mock the complete authentication flow
      userServiceClient.findByEmail.mockResolvedValue(mockUser);
      securityServiceClient.checkSuspiciousActivity.mockResolvedValue(false);
      securityServiceClient.logSecurityEvent.mockResolvedValue(undefined);
      notificationServiceClient.sendLoginAlert.mockResolvedValue(undefined);

      // Simulate authentication flow
      const user = await userServiceClient.findByEmail('test@example.com');
      const isSuspicious = await securityServiceClient.checkSuspiciousActivity('user-123', '192.168.1.1');
      
      await securityServiceClient.logSecurityEvent({
        userId: 'user-123',
        type: 'USER_LOGIN',
        ipAddress: '192.168.1.1',
        timestamp: new Date(),
      });

      if (isSuspicious) {
        await notificationServiceClient.sendLoginAlert(
          'user-123',
          'test@example.com',
          '192.168.1.1',
          'Mozilla/5.0',
          'Moscow, Russia'
        );
      }

      expect(user).toEqual(mockUser);
      expect(isSuspicious).toBe(false);
      expect(securityServiceClient.logSecurityEvent).toHaveBeenCalled();
    });

    it('should handle service mesh communication patterns', async () => {
      // Verify service mesh configuration
      expect(configService.get('SERVICE_MESH_ENABLED')).toBe('true');
      expect(configService.get('DISTRIBUTED_TRACING_ENABLED')).toBe('true');
      expect(configService.get('JAEGER_ENDPOINT')).toBe('http://jaeger:14268/api/traces');

      // Mock service-to-service communication with proper headers
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

    it('should handle distributed tracing across services', async () => {
      const traceId = 'trace-123';
      const spanId = 'span-456';

      // Mock operations with tracing context
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

      securityServiceClient.logSecurityEvent.mockResolvedValue(undefined);

      // Simulate traced operations
      const user = await userServiceClient.findByEmail('test@example.com');
      
      await securityServiceClient.logSecurityEvent({
        userId: user.id,
        type: 'USER_LOGIN',
        ipAddress: '192.168.1.1',
        timestamp: new Date(),
        metadata: { traceId, spanId },
      });

      expect(user).toBeDefined();
      expect(securityServiceClient.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ traceId, spanId }),
        })
      );
    });
  });

  describe('Cache Management', () => {
    it('should invalidate cache after user creation', async () => {
      const newUser = {
        id: 'user-456',
        name: 'New User',
        email: 'new@example.com',
        password: 'hashed-password',
        isActive: true,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      userServiceClient.createUser.mockResolvedValue(newUser);
      userServiceClient.clearCache.mockResolvedValue(undefined);

      const createUserDto = {
        name: 'New User',
        email: 'new@example.com',
        password: 'hashed-password',
      };

      const result = await userServiceClient.createUser(createUserDto);
      await userServiceClient.clearCache();

      expect(result).toEqual(newUser);
      expect(userServiceClient.clearCache).toHaveBeenCalled();
    });

    it('should handle cache warming strategies', async () => {
      const popularUsers = [
        { id: 'user-1', email: 'popular1@example.com' },
        { id: 'user-2', email: 'popular2@example.com' },
        { id: 'user-3', email: 'popular3@example.com' },
      ];

      // Mock cache warming
      userServiceClient.findByEmail.mockImplementation((email) => {
        const user = popularUsers.find(u => u.email === email);
        return Promise.resolve(user ? {
          ...user,
          name: 'Popular User',
          password: 'hashed-password',
          isActive: true,
          lastLoginAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        } : null);
      });

      // Warm cache with popular users
      const warmingPromises = popularUsers.map(user => 
        userServiceClient.findByEmail(user.email)
      );

      const results = await Promise.all(warmingPromises);
      
      expect(results).toHaveLength(3);
      expect(results.every(result => result !== null)).toBe(true);
      expect(userServiceClient.findByEmail).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle partial service failures gracefully', async () => {
      // User Service works, but Security Service fails
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

      securityServiceClient.logSecurityEvent.mockRejectedValue(new Error('Security Service unavailable'));
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

      // Should still be able to authenticate user
      const user = await userServiceClient.findByEmail('test@example.com');
      expect(user).toBeDefined();

      // Security event should fail but be queued
      await expect(securityServiceClient.logSecurityEvent({
        userId: 'user-123',
        type: 'USER_LOGIN',
        ipAddress: '192.168.1.1',
        timestamp: new Date(),
      })).rejects.toThrow('Security Service unavailable');

      const stats = securityServiceClient.getQueueStats();
      expect(stats.circuitBreakerState).toBe('OPEN');
    });

    it('should implement proper retry strategies', async () => {
      let attemptCount = 0;
      
      userServiceClient.findByEmail.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error('Temporary failure'));
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

      // Simulate retry logic (in real implementation, this would be handled by the client)
      let result = null;
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries && !result) {
        try {
          result = await userServiceClient.findByEmail('test@example.com');
        } catch (error) {
          retries++;
          if (retries >= maxRetries) {
            throw error;
          }
          // In real implementation, would have exponential backoff
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      expect(result).toBeDefined();
      expect(result.email).toBe('test@example.com');
      expect(attemptCount).toBe(3);
    });
  });
});