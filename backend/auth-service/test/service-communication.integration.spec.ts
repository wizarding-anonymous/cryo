import { Test, TestingModule } from '@nestjs/testing';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

import { UserServiceClient } from '../src/common/http-client/user-service.client';
import { SecurityServiceClient } from '../src/common/http-client/security-service.client';
import { NotificationServiceClient } from '../src/common/http-client/notification-service.client';
import { CircuitBreakerService } from '../src/common/circuit-breaker/circuit-breaker.service';
import { CircuitBreakerConfig } from '../src/common/circuit-breaker/circuit-breaker.config';
import { RedisService } from '../src/common/redis/redis.service';
import { TokenService } from '../src/token/token.service';
import { AuthDatabaseService } from '../src/database/auth-database.service';

describe('Advanced Service Communication Integration Tests', () => {
  let userServiceClient: UserServiceClient;
  let securityServiceClient: SecurityServiceClient;
  let notificationServiceClient: NotificationServiceClient;
  let redisService: RedisService;
  let tokenService: TokenService;
  let httpService: HttpService;
  let configService: ConfigService;

  // Mock Auth Database Service
  const mockAuthDatabaseService = {
    blacklistToken: jest.fn(),
    isTokenBlacklisted: jest.fn(),
    blacklistAllUserTokens: jest.fn(),
    getUserBlacklistedTokens: jest.fn(),
    cleanupExpiredTokens: jest.fn(),
  };

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
              
              // JWT configuration
              JWT_SECRET: 'test-secret-key',
              JWT_EXPIRES_IN: '1h',
              JWT_REFRESH_EXPIRES_IN: '7d',
              
              // Circuit breaker configuration
              CIRCUIT_BREAKER_TIMEOUT: '3000',
              CIRCUIT_BREAKER_ERROR_THRESHOLD: '50',
              CIRCUIT_BREAKER_RESET_TIMEOUT: '30000',
            }),
          ],
        }),
        JwtModule.registerAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            secret: configService.get<string>('JWT_SECRET', 'test-secret-key'),
            signOptions: {
              expiresIn: configService.get<string>('JWT_EXPIRES_IN', '1h'),
            },
          }),
          inject: [ConfigService],
        }),
      ],
      providers: [
        UserServiceClient,
        SecurityServiceClient,
        NotificationServiceClient,
        CircuitBreakerService,
        CircuitBreakerConfig,
        TokenService,
        {
          provide: RedisService,
          useValue: {
            blacklistToken: jest.fn(),
            isTokenBlacklisted: jest.fn(),
            removeFromBlacklist: jest.fn(),
            set: jest.fn(),
            get: jest.fn(),
            delete: jest.fn(),
            setNX: jest.fn(),
            getTTL: jest.fn(),
            keys: jest.fn(),
            mget: jest.fn(),
          },
        },
        {
          provide: AuthDatabaseService,
          useValue: mockAuthDatabaseService,
        },
      ],
    }).compile();

    userServiceClient = module.get<UserServiceClient>(UserServiceClient);
    securityServiceClient = module.get<SecurityServiceClient>(SecurityServiceClient);
    notificationServiceClient = module.get<NotificationServiceClient>(NotificationServiceClient);
    redisService = module.get<RedisService>(RedisService);
    tokenService = module.get<TokenService>(TokenService);
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

  describe('Redis Token Blacklisting Integration', () => {
    it('should blacklist token in shared Redis instance', async () => {
      const user = { id: 'user-123', email: 'test@example.com' };
      const tokens = await tokenService.generateTokens(user);

      // Mock successful Redis operations
      (redisService.blacklistToken as jest.Mock).mockResolvedValue(undefined);
      (redisService.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      mockAuthDatabaseService.blacklistToken.mockResolvedValue({});

      // Blacklist token
      await tokenService.blacklistToken(tokens.accessToken, user.id, 'logout');

      // Verify Redis was called with correct parameters
      expect(redisService.blacklistToken).toHaveBeenCalledWith(
        tokens.accessToken,
        expect.any(Number) // TTL in seconds
      );

      // Verify database was also called for persistence
      expect(mockAuthDatabaseService.blacklistToken).toHaveBeenCalledWith(
        expect.any(String), // token hash
        user.id,
        'logout',
        expect.any(Date), // expiration
        undefined
      );
    });

    it('should handle distributed token invalidation across microservices', async () => {
      const userId = 'user-123';

      // Mock Redis operations for user-level invalidation
      (redisService.set as jest.Mock).mockResolvedValue(undefined);
      (redisService.get as jest.Mock).mockResolvedValue('true');
      mockAuthDatabaseService.blacklistAllUserTokens.mockResolvedValue(undefined);

      // Invalidate all user tokens (security scenario)
      await tokenService.blacklistAllUserTokens(userId, 'security', { 
        reason: 'suspicious activity detected' 
      });

      // Verify Redis key was set for distributed invalidation
      expect(redisService.set).toHaveBeenCalledWith(
        `user_invalidated:${userId}`,
        'true',
        365 * 24 * 60 * 60 // 1 year TTL
      );

      // Verify database was updated
      expect(mockAuthDatabaseService.blacklistAllUserTokens).toHaveBeenCalledWith(
        userId,
        'security',
        { reason: 'suspicious activity detected' }
      );
    });
  });

  describe('Microservices Architecture Integration', () => {
    it('should handle cross-service authentication flow', async () => {
      // Simulate complete authentication flow across services
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

      const mockUserResponse: AxiosResponse = {
        data: mockUser,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      const mockSecurityResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      const mockNotificationResponse: AxiosResponse = {
        data: { success: true, notificationId: 'notif-123' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockUserResponse));
      jest.spyOn(httpService, 'post').mockReturnValue(of(mockSecurityResponse));
      jest.spyOn(httpService, 'patch').mockReturnValue(of(mockUserResponse));

      // Step 1: Validate user exists (User Service)
      const user = await userServiceClient.findByEmail('test@example.com');
      expect(user).toEqual(mockUser);

      // Step 2: Log security event (Security Service)
      const securityEvent = {
        userId: user!.id,
        type: 'USER_LOGIN' as const,
        ipAddress: '192.168.1.1',
        timestamp: new Date(),
      };
      await securityServiceClient.logSecurityEvent(securityEvent);

      // Step 3: Update last login (User Service)
      await userServiceClient.updateLastLogin(user!.id);

      // Step 4: Send notification (Notification Service)
      jest.spyOn(httpService, 'post').mockReturnValue(of(mockNotificationResponse));
      await notificationServiceClient.sendWelcomeNotification({
        userId: user!.id,
        email: user!.email,
        name: user!.name,
      });

      // Verify all services were called
      expect(httpService.get).toHaveBeenCalledWith(
        expect.stringContaining('user-service:3002'),
        expect.anything()
      );
      expect(httpService.post).toHaveBeenCalledWith(
        expect.stringContaining('security-service:3010'),
        expect.any(Object),
        expect.anything()
      );
      expect(httpService.patch).toHaveBeenCalledWith(
        expect.stringContaining('user-service:3002'),
        expect.any(Object),
        expect.anything()
      );
    });

    it('should handle service mesh communication patterns', async () => {
      // Test service-to-service communication with proper headers
      const mockResponse: AxiosResponse = {
        data: { id: 'user-123', email: 'test@example.com' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      await userServiceClient.findByEmail('test@example.com');

      // Verify request includes proper service identification headers
      expect(httpService.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('AuthService'),
          }),
          timeout: expect.any(Number),
        })
      );
    });

    it('should handle distributed tracing across services', async () => {
      // Mock correlation ID propagation
      const correlationId = 'trace-123-456-789';
      
      const mockResponse: AxiosResponse = {
        data: { id: 'user-123', email: 'test@example.com' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      // Simulate request with correlation ID
      process.env.CORRELATION_ID = correlationId;
      
      await userServiceClient.findByEmail('test@example.com');

      // Verify correlation ID is propagated in headers
      expect(httpService.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Correlation-ID': expect.any(String),
          }),
        })
      );

      delete process.env.CORRELATION_ID;
    });
  });

  describe('Cache Management', () => {
    it('should invalidate cache after user creation', async () => {
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

      const mockGetResponse: AxiosResponse = {
        data: mockUser,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      const mockPostResponse: AxiosResponse = {
        data: mockUser,
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockGetResponse));
      jest.spyOn(httpService, 'post').mockReturnValue(of(mockPostResponse));

      const createUserDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashed-password',
      };

      // Create user should cache the result
      await userServiceClient.createUser(createUserDto);

      // Subsequent calls should use cache
      await userServiceClient.findByEmail('test@example.com');
      await userServiceClient.findById('user-123');

      // Should have made 1 POST call and 0 GET calls (due to caching from creation)
      expect(httpService.post).toHaveBeenCalledTimes(1);
      expect(httpService.get).toHaveBeenCalledTimes(0);
    });
  });
});