import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { HttpAdapterHost } from '@nestjs/core';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { IntegrationService } from '../src/integrations/integration.service';
import { CircuitBreakerService } from '../src/integrations/circuit-breaker/circuit-breaker.service';

describe('Microservices Integration Tests (e2e)', () => {
  let app: INestApplication;
  let integrationService: IntegrationService;
  let circuitBreakerService: CircuitBreakerService;

  // Mock external services
  const mockAuthService = {
    notifyUserCreated: jest.fn(),
    notifyUserUpdated: jest.fn(),
    notifyUserDeleted: jest.fn(),
    validateToken: jest.fn(),
  };

  const mockGameCatalogService = {
    getUserGamePreferences: jest.fn(),
    updateUserGameSettings: jest.fn(),
    notifyUserPreferencesChanged: jest.fn(),
  };

  const mockPaymentService = {
    getUserBillingInfo: jest.fn(),
    updateBillingInfo: jest.fn(),
    notifyUserDataChanged: jest.fn(),
  };

  const mockNotificationService = {
    sendUserNotification: jest.fn(),
    updateNotificationPreferences: jest.fn(),
  };

  const mockSecurityService = {
    logSecurityEvent: jest.fn(),
    checkSuspiciousActivity: jest.fn(),
    reportDataAccess: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    })
      .overrideProvider('AuthServiceClient')
      .useValue(mockAuthService)
      .overrideProvider('GameCatalogServiceClient')
      .useValue(mockGameCatalogService)
      .overrideProvider('PaymentServiceClient')
      .useValue(mockPaymentService)
      .overrideProvider('NotificationServiceClient')
      .useValue(mockNotificationService)
      .overrideProvider('SecurityServiceClient')
      .useValue(mockSecurityService)
      .compile();

    app = moduleFixture.createNestApplication();
    integrationService = moduleFixture.get<IntegrationService>(IntegrationService);
    circuitBreakerService = moduleFixture.get<CircuitBreakerService>(CircuitBreakerService);

    // Apply global configurations
    const httpAdapterHost = app.get(HttpAdapterHost);
    app.useGlobalFilters(new GlobalExceptionFilter(httpAdapterHost, app.get('Logger')));
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('Auth Service Integration', () => {
    const testUser = {
      name: 'Auth Integration User',
      email: `auth-integration-${Date.now()}@example.com`,
      password: '$2b$10$hashedPasswordFromAuthService',
    };
    let createdUserId: string;

    it('should notify Auth Service when user is created', async () => {
      mockAuthService.notifyUserCreated.mockResolvedValue({ success: true });

      const response = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUser)
        .expect(201);

      createdUserId = response.body.data.id;

      // Verify Auth Service was notified
      expect(mockAuthService.notifyUserCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          id: createdUserId,
          email: testUser.email,
          name: testUser.name,
        })
      );
    });

    it('should notify Auth Service when user login is updated', async () => {
      mockAuthService.notifyUserUpdated.mockResolvedValue({ success: true });

      // First create a user
      const response = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send({
          ...testUser,
          email: `auth-login-${Date.now()}@example.com`,
        })
        .expect(201);

      const userId = response.body.data.id;

      // Update last login
      await request(app.getHttpServer())
        .patch(`/api/internal/users/${userId}/last-login`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      // Verify Auth Service was notified of the update
      expect(mockAuthService.notifyUserUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          id: userId,
          lastLoginAt: expect.any(String),
        })
      );
    });

    it('should handle Auth Service communication failures gracefully', async () => {
      mockAuthService.notifyUserCreated.mockRejectedValue(
        new Error('Auth Service unavailable')
      );

      // User creation should still succeed even if Auth Service notification fails
      const response = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send({
          ...testUser,
          email: `auth-failure-${Date.now()}@example.com`,
        })
        .expect(201);

      expect(response.body.data.id).toBeTruthy();
      expect(mockAuthService.notifyUserCreated).toHaveBeenCalled();
    });

    it('should implement circuit breaker for Auth Service calls', async () => {
      // Simulate multiple failures to trigger circuit breaker
      mockAuthService.notifyUserCreated.mockRejectedValue(
        new Error('Service unavailable')
      );

      const failurePromises = [];
      for (let i = 0; i < 5; i++) {
        failurePromises.push(
          request(app.getHttpServer())
            .post('/api/internal/users')
            .set('x-internal-service', 'user-service-internal')
            .send({
              ...testUser,
              email: `circuit-breaker-${i}-${Date.now()}@example.com`,
            })
        );
      }

      await Promise.all(failurePromises);

      // Circuit breaker should be open now
      const circuitStats = await circuitBreakerService.getCircuitStats('auth-service');
      expect(['OPEN', 'HALF_OPEN']).toContain(circuitStats.state);
    });
  });

  describe('Game Catalog Service Integration', () => {
    let testUserId: string;

    beforeEach(async () => {
      // Create a test user for Game Catalog integration tests
      const response = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send({
          name: 'Game Catalog User',
          email: `game-catalog-${Date.now()}@example.com`,
          password: '$2b$10$hashedPasswordFromAuthService',
        })
        .expect(201);

      testUserId = response.body.data.id;
    });

    it('should provide user profile data to Game Catalog Service', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/internal/users/${testUserId}/profile`)
        .set('x-internal-service', 'user-service-internal')
        .query({ includePreferences: 'true', includePrivacySettings: 'true' })
        .expect(200);

      expect(response.body.data).toHaveProperty('id', testUserId);
      expect(response.body.data).toHaveProperty('name');
      expect(response.body.data).toHaveProperty('avatarUrl');
      expect(response.body.data).toHaveProperty('preferences');
      expect(response.body.data).toHaveProperty('privacySettings');
      expect(response.body.data).toHaveProperty('isActive');
    });

    it('should handle batch profile requests from Game Catalog Service', async () => {
      // Create additional test users
      const additionalUsers = [];
      for (let i = 0; i < 3; i++) {
        const userResponse = await request(app.getHttpServer())
          .post('/api/internal/users')
          .set('x-internal-service', 'user-service-internal')
          .send({
            name: `Batch User ${i}`,
            email: `batch-user-${i}-${Date.now()}@example.com`,
            password: '$2b$10$hashedPasswordFromAuthService',
          })
          .expect(201);
        additionalUsers.push(userResponse.body.data.id);
      }

      const allUserIds = [testUserId, ...additionalUsers];

      const batchResponse = await request(app.getHttpServer())
        .post('/api/internal/users/batch/profiles')
        .set('x-internal-service', 'user-service-internal')
        .send({
          userIds: allUserIds,
          includePreferences: true,
          includePrivacySettings: false,
          chunkSize: 50,
        })
        .expect(200);

      expect(batchResponse.body.data.profiles).toHaveLength(4);
      expect(batchResponse.body.data.stats.requested).toBe(4);
      expect(batchResponse.body.data.stats.found).toBe(4);
      expect(batchResponse.body.data.stats.missing).toBe(0);

      // Verify each profile has expected structure
      batchResponse.body.data.profiles.forEach(profile => {
        expect(profile).toHaveProperty('id');
        expect(profile).toHaveProperty('name');
        expect(profile).toHaveProperty('preferences');
        expect(profile.privacySettings).toBeNull(); // Should be null as requested
      });
    });

    it('should notify Game Catalog Service when user preferences change', async () => {
      mockGameCatalogService.notifyUserPreferencesChanged.mockResolvedValue({ success: true });

      const newPreferences = {
        theme: 'dark',
        gameSettings: {
          autoDownload: true,
          cloudSave: false,
          achievementNotifications: true,
        },
      };

      await request(app.getHttpServer())
        .patch(`/api/internal/users/${testUserId}/preferences`)
        .set('x-internal-service', 'user-service-internal')
        .send(newPreferences)
        .expect(200);

      // Verify Game Catalog Service was notified
      expect(mockGameCatalogService.notifyUserPreferencesChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          preferences: expect.objectContaining({
            theme: 'dark',
            gameSettings: expect.objectContaining({
              autoDownload: true,
              cloudSave: false,
            }),
          }),
        })
      );
    });
  });

  describe('Payment Service Integration', () => {
    let testUserId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send({
          name: 'Payment User',
          email: `payment-user-${Date.now()}@example.com`,
          password: '$2b$10$hashedPasswordFromAuthService',
        })
        .expect(201);

      testUserId = response.body.data.id;
    });

    it('should provide billing information to Payment Service', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/internal/users/${testUserId}/billing-info`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      expect(response.body.data).toHaveProperty('userId', testUserId);
      expect(response.body.data).toHaveProperty('name');
      expect(response.body.data).toHaveProperty('email');
      expect(response.body.data).toHaveProperty('language');
      expect(response.body.data).toHaveProperty('timezone');
      expect(response.body.data).toHaveProperty('isActive');
      expect(response.body.data).toHaveProperty('createdAt');
    });

    it('should update billing information from Payment Service', async () => {
      mockPaymentService.notifyUserDataChanged.mockResolvedValue({ success: true });

      const billingUpdate = {
        name: 'Updated Payment User',
        language: 'es',
        timezone: 'America/New_York',
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/internal/users/${testUserId}/billing-info`)
        .set('x-internal-service', 'user-service-internal')
        .send(billingUpdate)
        .expect(200);

      expect(response.body.data.name).toBe(billingUpdate.name);
      expect(response.body.data.language).toBe(billingUpdate.language);
      expect(response.body.data.timezone).toBe(billingUpdate.timezone);

      // Verify Payment Service was notified
      expect(mockPaymentService.notifyUserDataChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          changes: expect.objectContaining({
            name: billingUpdate.name,
            language: billingUpdate.language,
            timezone: billingUpdate.timezone,
          }),
        })
      );
    });

    it('should handle Payment Service timeout gracefully', async () => {
      mockPaymentService.notifyUserDataChanged.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 5000)) // 5 second delay
      );

      const billingUpdate = {
        name: 'Timeout Test User',
        language: 'fr',
      };

      // Request should complete even if Payment Service notification times out
      const response = await request(app.getHttpServer())
        .patch(`/api/internal/users/${testUserId}/billing-info`)
        .set('x-internal-service', 'user-service-internal')
        .send(billingUpdate)
        .expect(200);

      expect(response.body.data.name).toBe(billingUpdate.name);
    });
  });

  describe('Security Service Integration', () => {
    let testUserId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send({
          name: 'Security Test User',
          email: `security-test-${Date.now()}@example.com`,
          password: '$2b$10$hashedPasswordFromAuthService',
        })
        .expect(201);

      testUserId = response.body.data.id;
    });

    it('should log security events to Security Service', async () => {
      mockSecurityService.logSecurityEvent.mockResolvedValue({ success: true });

      // Access user data (should trigger security logging)
      await request(app.getHttpServer())
        .get(`/api/internal/users/${testUserId}`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      // Verify Security Service received the audit log
      expect(mockSecurityService.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'DATA_ACCESS',
          userId: testUserId,
          resource: 'user',
          operation: 'READ',
        })
      );
    });

    it('should report suspicious activity to Security Service', async () => {
      mockSecurityService.checkSuspiciousActivity.mockResolvedValue({ 
        suspicious: false,
        riskScore: 0.1 
      });

      // Multiple rapid requests from same IP (potential suspicious activity)
      const rapidRequests = Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .get(`/api/internal/users/${testUserId}`)
          .set('x-internal-service', 'user-service-internal')
          .set('x-forwarded-for', '192.168.1.100')
      );

      await Promise.all(rapidRequests);

      // Security Service should have been called to check for suspicious activity
      expect(mockSecurityService.checkSuspiciousActivity).toHaveBeenCalled();
    });

    it('should handle Security Service failures without blocking operations', async () => {
      mockSecurityService.logSecurityEvent.mockRejectedValue(
        new Error('Security Service unavailable')
      );

      // User operations should continue even if Security Service is down
      const response = await request(app.getHttpServer())
        .get(`/api/internal/users/${testUserId}`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      expect(response.body.data.id).toBe(testUserId);
      expect(mockSecurityService.logSecurityEvent).toHaveBeenCalled();
    });
  });

  describe('Event Publishing and Message Queue Integration', () => {
    let testUserId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send({
          name: 'Event Test User',
          email: `event-test-${Date.now()}@example.com`,
          password: '$2b$10$hashedPasswordFromAuthService',
        })
        .expect(201);

      testUserId = response.body.data.id;
    });

    it('should publish user creation events', async () => {
      // Mock event publisher
      const publishSpy = jest.spyOn(integrationService, 'publishUserEvent');
      publishSpy.mockResolvedValue(undefined);

      const newUser = {
        name: 'Event Publishing User',
        email: `event-pub-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      };

      await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(newUser)
        .expect(201);

      // Verify event was published
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'USER_CREATED',
          data: expect.objectContaining({
            email: newUser.email,
            name: newUser.name,
          }),
        })
      );

      publishSpy.mockRestore();
    });

    it('should publish user update events', async () => {
      const publishSpy = jest.spyOn(integrationService, 'publishUserEvent');
      publishSpy.mockResolvedValue(undefined);

      // Update user last login
      await request(app.getHttpServer())
        .patch(`/api/internal/users/${testUserId}/last-login`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      // Verify update event was published
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'USER_UPDATED',
          userId: testUserId,
          data: expect.objectContaining({
            lastLoginAt: expect.any(String),
          }),
        })
      );

      publishSpy.mockRestore();
    });

    it('should handle event publishing failures gracefully', async () => {
      const publishSpy = jest.spyOn(integrationService, 'publishUserEvent');
      publishSpy.mockRejectedValue(new Error('Message queue unavailable'));

      // User operations should continue even if event publishing fails
      const response = await request(app.getHttpServer())
        .patch(`/api/internal/users/${testUserId}/last-login`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      expect(response.body.message).toBe('Last login updated successfully');
      expect(publishSpy).toHaveBeenCalled();

      publishSpy.mockRestore();
    });
  });

  describe('Cross-Service Data Consistency', () => {
    it('should maintain data consistency across service boundaries', async () => {
      // Create user
      const testUser = {
        name: 'Consistency Test User',
        email: `consistency-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUser)
        .expect(201);

      const userId = createResponse.body.data.id;

      // Update user preferences
      const preferences = {
        language: 'es',
        timezone: 'Europe/Madrid',
        theme: 'dark',
      };

      await request(app.getHttpServer())
        .patch(`/api/internal/users/${userId}/preferences`)
        .set('x-internal-service', 'user-service-internal')
        .send(preferences)
        .expect(200);

      // Verify data consistency across different endpoints
      const profileResponse = await request(app.getHttpServer())
        .get(`/api/internal/users/${userId}/profile`)
        .set('x-internal-service', 'user-service-internal')
        .query({ includePreferences: 'true' })
        .expect(200);

      const billingResponse = await request(app.getHttpServer())
        .get(`/api/internal/users/${userId}/billing-info`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      const preferencesResponse = await request(app.getHttpServer())
        .get(`/api/internal/users/${userId}/preferences`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      // All endpoints should return consistent data
      expect(profileResponse.body.data.preferences.language).toBe(preferences.language);
      expect(billingResponse.body.data.language).toBe(preferences.language);
      expect(preferencesResponse.body.data.language).toBe(preferences.language);
    });

    it('should handle partial service failures without data corruption', async () => {
      // Simulate partial failure scenario
      mockGameCatalogService.notifyUserPreferencesChanged.mockRejectedValue(
        new Error('Game Catalog Service temporarily unavailable')
      );

      const testUser = {
        name: 'Partial Failure User',
        email: `partial-failure-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUser)
        .expect(201);

      const userId = createResponse.body.data.id;

      // Update preferences (should succeed despite Game Catalog Service failure)
      const preferences = { theme: 'dark', language: 'fr' };

      const updateResponse = await request(app.getHttpServer())
        .patch(`/api/internal/users/${userId}/preferences`)
        .set('x-internal-service', 'user-service-internal')
        .send(preferences)
        .expect(200);

      expect(updateResponse.body.data.theme).toBe(preferences.theme);
      expect(updateResponse.body.data.language).toBe(preferences.language);

      // Verify data was actually saved despite service failure
      const verifyResponse = await request(app.getHttpServer())
        .get(`/api/internal/users/${userId}/preferences`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      expect(verifyResponse.body.data.theme).toBe(preferences.theme);
      expect(verifyResponse.body.data.language).toBe(preferences.language);
    });
  });

  describe('Service Discovery and Health Checks', () => {
    it('should report health status including external service dependencies', async () => {
      const healthResponse = await request(app.getHttpServer())
        .get('/api/health')
        .expect((res) => {
          expect([200, 503]).toContain(res.status);
        });

      expect(healthResponse.body).toHaveProperty('status');
      expect(healthResponse.body).toHaveProperty('info');
      expect(healthResponse.body).toHaveProperty('details');

      // Should include checks for external services
      const details = healthResponse.body.details;
      expect(details).toHaveProperty('database');
      
      // May include Redis and other service health checks
      if (details.redis) {
        expect(details.redis).toHaveProperty('status');
      }
    });

    it('should handle graceful degradation when external services are unavailable', async () => {
      // Simulate all external services being down
      mockAuthService.notifyUserCreated.mockRejectedValue(new Error('Service down'));
      mockGameCatalogService.notifyUserPreferencesChanged.mockRejectedValue(new Error('Service down'));
      mockPaymentService.notifyUserDataChanged.mockRejectedValue(new Error('Service down'));
      mockSecurityService.logSecurityEvent.mockRejectedValue(new Error('Service down'));

      // Core functionality should still work
      const testUser = {
        name: 'Degraded Mode User',
        email: `degraded-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      };

      const response = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUser)
        .expect(201);

      expect(response.body.data.id).toBeTruthy();
      expect(response.body.data.email).toBe(testUser.email);
    });
  });
});