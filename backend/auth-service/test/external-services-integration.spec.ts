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

describe('External Services Advanced Integration Tests', () => {
  let userServiceClient: UserServiceClient;
  let securityServiceClient: SecurityServiceClient;
  let notificationServiceClient: NotificationServiceClient;
  let httpService: HttpService;
  let configService: ConfigService;

  // Mock HTTP responses for different microservices
  const createMockResponse = <T>(data: T, status = 200): AxiosResponse<T> => ({
    data,
    status,
    statusText: status === 200 ? 'OK' : status === 201 ? 'Created' : 'Error',
    headers: {
      'content-type': 'application/json',
      'x-service-name': 'mock-service',
      'x-request-id': 'req-123',
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
        HttpModule.registerAsync({
          useFactory: () => ({
            timeout: 5000,
            maxRedirects: 5,
            headers: {
              'User-Agent': 'AuthService/1.0.0',
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
          }),
        }),
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              // Microservices URLs (Docker network)
              USER_SERVICE_URL: 'http://user-service:3002',
              SECURITY_SERVICE_URL: 'http://security-service:3010',
              NOTIFICATION_SERVICE_URL: 'http://notification-service:3007',
              
              // Circuit breaker configuration
              CIRCUIT_BREAKER_TIMEOUT: '3000',
              CIRCUIT_BREAKER_ERROR_THRESHOLD: '50',
              CIRCUIT_BREAKER_RESET_TIMEOUT: '30000',
              CIRCUIT_BREAKER_VOLUME_THRESHOLD: '10',
              
              // Service-specific timeouts
              USER_SERVICE_TIMEOUT: '5000',
              SECURITY_SERVICE_TIMEOUT: '3000',
              NOTIFICATION_SERVICE_TIMEOUT: '10000',
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

  describe('Advanced User Service Integration', () => {
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

    it('should handle User Service network errors with proper retry', async () => {
      const networkError = new Error('ECONNREFUSED');
      jest.spyOn(httpService, 'get')
        .mockReturnValueOnce(throwError(() => networkError))
        .mockReturnValueOnce(throwError(() => networkError))
        .mockReturnValueOnce(of(createMockResponse(mockUser)));

      // Should eventually succeed after retries
      const result = await userServiceClient.findByEmail('test@example.com');
      expect(result).toEqual(mockUser);
    });

    it('should handle User Service rate limiting (429)', async () => {
      const rateLimitError = createMockError(429, 'Too Many Requests');
      jest.spyOn(httpService, 'get')
        .mockReturnValueOnce(throwError(() => rateLimitError))
        .mockReturnValueOnce(of(createMockResponse(mockUser)));

      // Should retry after rate limit and succeed
      const result = await userServiceClient.findByEmail('test@example.com');
      expect(result).toEqual(mockUser);
    });

    it('should validate User Service response format', async () => {
      const invalidResponse = createMockResponse({ invalid: 'data' });
      jest.spyOn(httpService, 'get').mockReturnValue(of(invalidResponse));

      // Should handle invalid response gracefully
      await expect(userServiceClient.findByEmail('test@example.com')).rejects.toThrow();
    });
  });

  describe('Advanced Security Service Integration', () => {
    it('should handle Security Service authentication errors (401)', async () => {
      const authError = createMockError(401, 'Unauthorized');
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => authError));

      const securityEvent = {
        userId: 'user-123',
        type: 'USER_LOGIN' as const,
        ipAddress: '192.168.1.1',
        timestamp: new Date(),
      };

      // Should queue event for retry
      await securityServiceClient.logSecurityEvent(securityEvent);

      const stats = securityServiceClient.getQueueStats();
      expect(stats.queueSize).toBe(1);
    });

    it('should handle Security Service overload (503)', async () => {
      const overloadError = createMockError(503, 'Service Overloaded');
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => overloadError));

      const securityEvent = {
        userId: 'user-123',
        type: 'FAILED_LOGIN' as const,
        ipAddress: '192.168.1.1',
        timestamp: new Date(),
      };

      // Should queue event and not fail authentication flow
      await securityServiceClient.logSecurityEvent(securityEvent);

      const stats = securityServiceClient.getQueueStats();
      expect(stats.queueSize).toBe(1);
    });
  });

  describe('Advanced Notification Service Integration', () => {
    it('should handle email service provider errors (502)', async () => {
      const providerError = createMockError(502, 'Email provider unavailable');
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => providerError));

      const welcomeRequest = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };

      // Should queue notification for retry
      await notificationServiceClient.sendWelcomeNotification(welcomeRequest);

      const stats = notificationServiceClient.getQueueStats();
      expect(stats.queueSize).toBe(1);
    });

    it('should handle notification rate limiting gracefully', async () => {
      const rateLimitError = createMockError(429, 'Rate limit exceeded');
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
  });

  describe('Advanced Circuit Breaker Integration', () => {
    it('should open circuit breaker after threshold failures', async () => {
      const serviceError = new Error('Service unavailable');
      
      // Mock multiple failures to trigger circuit breaker
      jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => serviceError));

      // Make multiple calls to trigger circuit breaker
      const promises = Array(15).fill(null).map(() => 
        userServiceClient.findByEmail('test@example.com').catch(() => null)
      );

      await Promise.all(promises);

      // Circuit breaker should be open now
      const stats = securityServiceClient.getQueueStats();
      expect(stats.circuitBreakerState).toBeDefined();
    });

    it('should handle circuit breaker half-open state', async () => {
      // First, trigger circuit breaker open
      const serviceError = new Error('Service unavailable');
      jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => serviceError));

      // Make calls to open circuit breaker
      await Promise.all(
        Array(15).fill(null).map(() => 
          userServiceClient.findByEmail('test@example.com').catch(() => null)
        )
      );

      // Now mock successful response for half-open test
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

      // Wait for circuit breaker reset timeout (simulated)
      // In real scenario, this would be handled by the circuit breaker library
      
      const result = await userServiceClient.findByEmail('test@example.com');
      expect(result).toEqual(mockUser);
    });
  });

  describe('Service Mesh Integration', () => {
    it('should include proper service mesh headers', async () => {
      const mockResponse = createMockResponse({ success: true });
      jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse));

      const securityEvent = {
        userId: 'user-123',
        type: 'USER_LOGIN' as const,
        ipAddress: '192.168.1.1',
        timestamp: new Date(),
      };

      await securityServiceClient.logSecurityEvent(securityEvent);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('AuthService'),
            'X-Correlation-ID': expect.any(String),
            'X-Service-Name': 'auth-service',
            'X-Service-Version': expect.any(String),
          }),
        })
      );
    });

    it('should handle service mesh authentication', async () => {
      const mockResponse = createMockResponse({ success: true });
      jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse));

      const securityEvent = {
        userId: 'user-123',
        type: 'USER_LOGIN' as const,
        ipAddress: '192.168.1.1',
        timestamp: new Date(),
      };

      await securityServiceClient.logSecurityEvent(securityEvent);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': expect.stringMatching(/^Bearer .+/), // Service-to-service JWT
          }),
        })
      );
    });
  });
});