import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationService, UserEvent } from './integration.service';
import { NotificationClient } from './notification/notification.client';
import { SecurityClient } from './security/security.client';
import { AuthServiceClient } from './auth/auth-service.client';
import { EventPublisherService } from './events/event-publisher.service';
import { CircuitBreakerService } from './circuit-breaker/circuit-breaker.service';
import { User } from '../user/entities/user.entity';

describe('IntegrationService', () => {
  let service: IntegrationService;
  let notificationClient: jest.Mocked<NotificationClient>;
  let securityClient: jest.Mocked<SecurityClient>;
  let authServiceClient: jest.Mocked<AuthServiceClient>;
  let eventPublisher: jest.Mocked<EventPublisherService>;
  let circuitBreaker: jest.Mocked<CircuitBreakerService>;

  const mockUser: User = {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    password: 'hashed-password',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    lastLoginAt: new Date(),
    avatarUrl: null,
    preferences: null,
    privacySettings: null,
    isActive: true,
    metadata: null,
  };

  beforeEach(async () => {
    const mockNotificationClient = {
      sendWelcomeNotification: jest.fn(),
    };

    const mockSecurityClient = {
      logSecurityEvent: jest.fn(),
    };

    const mockAuthServiceClient = {
      notifyUserCreated: jest.fn(),
      notifyUserUpdated: jest.fn(),
      notifyUserDeleted: jest.fn(),
      healthCheck: jest.fn(),
    };

    const mockEventPublisher = {
      publishEvent: jest.fn(),
      healthCheck: jest.fn(),
    };

    const mockCircuitBreaker = {
      execute: jest.fn(),
      getCircuitStats: jest.fn(),
      resetCircuit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationService,
        { provide: NotificationClient, useValue: mockNotificationClient },
        { provide: SecurityClient, useValue: mockSecurityClient },
        { provide: AuthServiceClient, useValue: mockAuthServiceClient },
        { provide: EventPublisherService, useValue: mockEventPublisher },
        { provide: CircuitBreakerService, useValue: mockCircuitBreaker },
      ],
    }).compile();

    service = module.get<IntegrationService>(IntegrationService);
    notificationClient = module.get(NotificationClient);
    securityClient = module.get(SecurityClient);
    authServiceClient = module.get(AuthServiceClient);
    eventPublisher = module.get(EventPublisherService);
    circuitBreaker = module.get(CircuitBreakerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('notifyUserCreated', () => {
    it('should notify Auth Service and publish event successfully', async () => {
      // Arrange
      circuitBreaker.execute.mockImplementation(async (name, operation) => {
        return await operation();
      });
      authServiceClient.notifyUserCreated.mockResolvedValue();
      eventPublisher.publishEvent.mockResolvedValue();

      // Act
      await service.notifyUserCreated(mockUser);

      // Assert
      expect(circuitBreaker.execute).toHaveBeenCalledTimes(2);
      expect(authServiceClient.notifyUserCreated).toHaveBeenCalledWith(
        mockUser,
      );
      expect(eventPublisher.publishEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'USER_CREATED',
          userId: mockUser.id,
          data: { email: mockUser.email, name: mockUser.name },
        }),
      );
    });

    it('should handle Auth Service failure with graceful degradation', async () => {
      // Arrange
      const authError = new Error('Auth Service unavailable');
      circuitBreaker.execute
        .mockImplementationOnce(async (name, operation, fallback) => {
          // Auth service fails, execute fallback
          return await fallback();
        })
        .mockImplementationOnce(async (name, operation) => {
          // Event publisher succeeds
          return await operation();
        });

      // Act
      await service.notifyUserCreated(mockUser);

      // Assert
      expect(circuitBreaker.execute).toHaveBeenCalledTimes(2);
      expect(eventPublisher.publishEvent).toHaveBeenCalled();
    });

    it('should handle event publishing failure gracefully', async () => {
      // Arrange
      circuitBreaker.execute
        .mockImplementationOnce(async (name, operation) => {
          // Auth service succeeds
          return await operation();
        })
        .mockImplementationOnce(async (name, operation, fallback) => {
          // Event publisher fails, execute fallback
          return await fallback();
        });

      authServiceClient.notifyUserCreated.mockResolvedValue();

      // Act
      await service.notifyUserCreated(mockUser);

      // Assert
      expect(circuitBreaker.execute).toHaveBeenCalledTimes(2);
      expect(authServiceClient.notifyUserCreated).toHaveBeenCalledWith(
        mockUser,
      );
    });
  });

  describe('notifyUserUpdated', () => {
    it('should notify Auth Service about user updates', async () => {
      // Arrange
      const changes = { name: 'Updated Name' };
      circuitBreaker.execute.mockImplementation(async (name, operation) => {
        return await operation();
      });
      authServiceClient.notifyUserUpdated.mockResolvedValue();
      eventPublisher.publishEvent.mockResolvedValue();

      // Act
      await service.notifyUserUpdated(mockUser, changes);

      // Assert
      expect(authServiceClient.notifyUserUpdated).toHaveBeenCalledWith(
        mockUser,
        changes,
      );
      expect(eventPublisher.publishEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'USER_UPDATED',
          userId: mockUser.id,
          data: { changes },
        }),
      );
    });
  });

  describe('notifyUserDeleted', () => {
    it('should notify Auth Service about user deletion', async () => {
      // Arrange
      circuitBreaker.execute.mockImplementation(async (name, operation) => {
        return await operation();
      });
      authServiceClient.notifyUserDeleted.mockResolvedValue();
      eventPublisher.publishEvent.mockResolvedValue();

      // Act
      await service.notifyUserDeleted(mockUser.id);

      // Assert
      expect(authServiceClient.notifyUserDeleted).toHaveBeenCalledWith(
        mockUser.id,
      );
      expect(eventPublisher.publishEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'USER_DELETED',
          userId: mockUser.id,
        }),
      );
    });
  });

  describe('publishUserEvent', () => {
    it('should publish user event successfully', async () => {
      // Arrange
      const event: UserEvent = {
        type: 'USER_CREATED',
        userId: mockUser.id,
        timestamp: new Date(),
        data: { test: 'data' },
        correlationId: 'test-correlation-id',
      };

      circuitBreaker.execute.mockImplementation(async (name, operation) => {
        return await operation();
      });
      eventPublisher.publishEvent.mockResolvedValue();

      // Act
      await service.publishUserEvent(event);

      // Assert
      expect(circuitBreaker.execute).toHaveBeenCalledWith(
        'event-publisher',
        expect.any(Function),
        expect.any(Function),
      );
      expect(eventPublisher.publishEvent).toHaveBeenCalledWith(event);
    });

    it('should handle event publishing failure gracefully', async () => {
      // Arrange
      const event: UserEvent = {
        type: 'USER_CREATED',
        userId: mockUser.id,
        timestamp: new Date(),
        data: { test: 'data' },
        correlationId: 'test-correlation-id',
      };

      circuitBreaker.execute.mockImplementation(
        async (name, operation, fallback) => {
          return await fallback();
        },
      );

      // Act & Assert - should not throw
      await expect(service.publishUserEvent(event)).resolves.toBeUndefined();
    });
  });

  describe('handleExternalUserRequest', () => {
    it('should handle external service request successfully', async () => {
      // Arrange
      const serviceId = 'game-catalog-service';
      const userId = mockUser.id;
      const expectedResult = { userId, serviceId, timestamp: expect.any(Date) };

      circuitBreaker.execute.mockImplementation(async (name, operation) => {
        return await operation();
      });

      // Act
      const result = await service.handleExternalUserRequest(serviceId, userId);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(circuitBreaker.execute).toHaveBeenCalledWith(
        `external-${serviceId}`,
        expect.any(Function),
        expect.any(Function),
      );
    });

    it('should return cached data when external service is unavailable', async () => {
      // Arrange
      const serviceId = 'game-catalog-service';
      const userId = mockUser.id;

      circuitBreaker.execute.mockImplementation(
        async (name, operation, fallback) => {
          return await fallback();
        },
      );

      // Act
      const result = await service.handleExternalUserRequest(serviceId, userId);

      // Assert
      expect(result).toEqual({
        userId,
        serviceId,
        cached: true,
        timestamp: expect.any(Date),
        message: 'Service temporarily unavailable, using cached data',
      });
    });
  });

  describe('callExternalService', () => {
    it('should call external service successfully', async () => {
      // Arrange
      const serviceName = 'test-service';
      const operation = jest.fn().mockResolvedValue('success');

      circuitBreaker.execute.mockImplementation(async (name, op) => {
        return await op();
      });

      // Act
      const result = await service.callExternalService(serviceName, operation);

      // Assert
      expect(result).toBe('success');
      expect(circuitBreaker.execute).toHaveBeenCalledWith(
        serviceName,
        operation,
        expect.any(Function),
      );
    });

    it('should handle service failure with graceful degradation', async () => {
      // Arrange
      const serviceName = 'test-service';
      const operation = jest.fn().mockRejectedValue(new Error('Service error'));

      circuitBreaker.execute.mockImplementation(async (name, op, fallback) => {
        return await fallback();
      });

      // Act
      const result = await service.callExternalService(serviceName, operation);

      // Assert
      expect(result).toEqual({
        service: serviceName,
        available: false,
        timestamp: expect.any(Date),
        message: 'Service temporarily unavailable',
      });
    });
  });
});
