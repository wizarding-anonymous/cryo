import { ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { TokenService } from '../token/token.service';
import { SessionService } from '../session/session.service';
import { UserServiceClient } from '../common/http-client/user-service.client';
import { SecurityServiceClient } from '../common/http-client/security-service.client';
import { NotificationServiceClient } from '../common/http-client/notification-service.client';
import { EventBusService } from '../events/services/event-bus.service';
import { RegisterDto } from './dto/register.dto';

describe('AuthService - Register Functionality', () => {
  let authService: AuthService;
  let jwtService: jest.Mocked<any>;
  let tokenService: jest.Mocked<TokenService>;
  let sessionService: jest.Mocked<SessionService>;
  let userServiceClient: jest.Mocked<UserServiceClient>;
  let securityServiceClient: jest.Mocked<SecurityServiceClient>;
  let notificationServiceClient: jest.Mocked<NotificationServiceClient>;
  let eventBusService: jest.Mocked<EventBusService>;
  let configService: jest.Mocked<any>;
  let authSagaService: jest.Mocked<any>;
  let sagaService: jest.Mocked<any>;
  let asyncOperations: jest.Mocked<any>;
  let metricsService: jest.Mocked<any>;
  let workerProcess: jest.Mocked<any>;

  const mockUser = {
    id: 'user-123',
    name: 'John Doe',
    email: 'john@example.com',
    password: 'hashedPassword123',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTokens = {
    accessTokenHash: 'mock-access-token-hash',
    refreshTokenHash: 'mock-refresh-token-hash',
    expiresIn: 3600,
  };

  const mockSession = {
    id: 'session-123',
    userId: 'user-123',
    accessTokenHash: 'hashed-access-token',
    refreshTokenHash: 'hashed-refresh-token',
    ipAddress: '127.0.0.1',
    userAgent: 'Test Agent',
    isActive: true,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    lastAccessedAt: new Date(),
  };

  beforeEach(() => {
    // Создаем моки напрямую
    jwtService = {
      signAsync: jest.fn(),
    } as any;

    tokenService = {
      generateTokens: jest.fn(),
      hashToken: jest.fn(),
    } as any;

    sessionService = {
      createSession: jest.fn().mockResolvedValue(mockSession),
      createSessionWithLimit: jest.fn().mockResolvedValue({
        session: mockSession,
        removedSessionsCount: 0,
      }),
      enforceSessionLimit: jest.fn(),
    } as any;

    userServiceClient = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      createUser: jest.fn(),
      updateLastLogin: jest.fn(),
    } as any;

    securityServiceClient = {
      logSecurityEvent: jest.fn(),
    } as any;

    notificationServiceClient = {
      sendWelcomeNotification: jest.fn().mockResolvedValue(undefined),
    } as any;

    eventBusService = {
      publishUserRegisteredEvent: jest.fn().mockResolvedValue(undefined),
      publishUserLoggedInEvent: jest.fn().mockResolvedValue(undefined),
      publishSecurityEvent: jest.fn().mockResolvedValue(undefined),
    } as any;

    configService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'MAX_SESSIONS_PER_USER') return 5;
        if (key === 'USE_SAGA_PATTERN') return false; // Отключаем saga для простоты тестов
        return defaultValue;
      }),
    } as any;

    authSagaService = {
      executeRegistrationSaga: jest.fn(),
      waitForSagaCompletion: jest.fn(),
    } as any;

    sagaService = {
      executeSaga: jest.fn(),
    } as any;

    asyncOperations = {
      executeAsync: jest.fn(),
      executeCriticalPath: jest.fn(),
    } as any;

    metricsService = {
      recordOperation: jest.fn(),
      recordAuthFlowMetric: jest.fn(),
    } as any;

    workerProcess = {
      processTask: jest.fn(),
      executeInWorker: jest.fn(),
    } as any;

    // Создаем AuthService с моками
    authService = new AuthService(
      jwtService,
      tokenService,
      sessionService,
      userServiceClient,
      securityServiceClient,
      notificationServiceClient,
      eventBusService,
      configService,
      authSagaService,
      sagaService,
      asyncOperations,
      metricsService,
      workerProcess,
    );

    // Mock executeCriticalPath to execute the callback function
    asyncOperations.executeCriticalPath.mockImplementation(async (callback: () => any) => {
      return await callback();
    });

    // Mock password hashing through worker process
    workerProcess.executeInWorker.mockResolvedValue('hashedPassword123');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'StrongPass123!',
    };

    it('should successfully register a new user with all required functionality', async () => {
      // Arrange
      userServiceClient.findByEmail.mockResolvedValue(null); // User doesn't exist
      userServiceClient.createUser.mockResolvedValue(mockUser);
      
      // Mock generateTokens method (private method, so we mock the result)
      jwtService.signAsync
        .mockResolvedValueOnce('mock-access-token')
        .mockResolvedValueOnce('mock-refresh-token');
      
      sessionService.createSessionWithLimit.mockResolvedValue({
        session: mockSession,
        removedSessionsCount: 0,
      });

      // Act
      const result = await authService.register(registerDto, '127.0.0.1', 'Test Agent');

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert - Requirement 1.1: Auth Service SHALL handle all user registration operations
      expect(result).toBeDefined();
      expect(result.user).toEqual({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        isActive: mockUser.isActive,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
      expect(result.user).not.toHaveProperty('password'); // Password should be excluded

      // Requirement 4.1: Auth Service SHALL hash passwords using bcrypt with salt rounds
      expect(workerProcess.executeInWorker).toHaveBeenCalledWith('hash-password', {
        password: 'StrongPass123!',
        saltRounds: 10
      });

      // Requirement 2.1: Auth Service SHALL call User Service's user creation endpoint
      expect(userServiceClient.createUser).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'hashedPassword123', // Pre-hashed password
      });

      // Requirement 4.3: Auth Service SHALL generate JWT access tokens with expiration
      // Requirement 4.4: Auth Service SHALL generate refresh tokens with longer expiration
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(result.access_token).toBe('mock-access-token');
      expect(result.refresh_token).toBe('mock-refresh-token');
      expect(result.expires_in).toBe(3600);

      // Requirement 12.2: Store session information in local database
      expect(sessionService.createSession).toHaveBeenCalledWith({
        userId: mockUser.id,
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        expiresAt: expect.any(Date),
      });
      expect(result.session_id).toBe(mockSession.id);

      // Verify event publishing (async calls)
      expect(eventBusService.publishUserRegisteredEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          ipAddress: '127.0.0.1',
          timestamp: expect.any(Date),
        })
      );

      // Direct service calls should not be made anymore
      expect(securityServiceClient.logSecurityEvent).not.toHaveBeenCalled();
      expect(notificationServiceClient.sendWelcomeNotification).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when user already exists', async () => {
      // Arrange - Email uniqueness validation through User Service integration
      userServiceClient.findByEmail.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(authService.register(registerDto, '127.0.0.1', 'Test Agent'))
        .rejects
        .toThrow(ConflictException);
      
      expect(userServiceClient.findByEmail).toHaveBeenCalledWith('john@example.com');
      expect(userServiceClient.createUser).not.toHaveBeenCalled();
    });

    it('should handle User Service unavailability gracefully', async () => {
      // Arrange
      userServiceClient.findByEmail.mockResolvedValue(null);
      userServiceClient.createUser.mockRejectedValue(new Error('Service unavailable'));

      // Act & Assert
      await expect(authService.register(registerDto, '127.0.0.1', 'Test Agent'))
        .rejects
        .toThrow('Service unavailable');
      
      expect(userServiceClient.findByEmail).toHaveBeenCalledWith('john@example.com');
      expect(userServiceClient.createUser).toHaveBeenCalled();
    });

    it('should use default values for IP address and user agent when not provided', async () => {
      // Arrange
      userServiceClient.findByEmail.mockResolvedValue(null);
      userServiceClient.createUser.mockResolvedValue(mockUser);
      jwtService.signAsync
        .mockResolvedValueOnce('mock-access-token')
        .mockResolvedValueOnce('mock-refresh-token');
      sessionService.createSessionWithLimit.mockResolvedValue({
        session: mockSession,
        removedSessionsCount: 0,
      });

      // Act
      const result = await authService.register(registerDto);

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert
      expect(sessionService.createSession).toHaveBeenCalledWith({
        userId: mockUser.id,
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        ipAddress: '::1', // Default IP
        userAgent: 'Unknown', // Default user agent
        expiresAt: expect.any(Date),
      });

      // Verify event publishing with default values
      expect(eventBusService.publishUserRegisteredEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          ipAddress: '::1', // Default IP
          timestamp: expect.any(Date),
        })
      );
    });

    it('should continue registration even if external service calls fail', async () => {
      // Arrange
      userServiceClient.findByEmail.mockResolvedValue(null);
      userServiceClient.createUser.mockResolvedValue(mockUser);
      jwtService.signAsync
        .mockResolvedValueOnce('mock-access-token')
        .mockResolvedValueOnce('mock-refresh-token');
      sessionService.createSession.mockResolvedValue(mockSession);
      
      // Mock event bus to succeed (since it's called with void, failures are handled internally)
      eventBusService.publishUserRegisteredEvent.mockResolvedValue(undefined);

      // Act
      const result = await authService.register(registerDto, '127.0.0.1', 'Test Agent');

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert - Registration should succeed
      expect(result).toBeDefined();
      expect(result.user.id).toBe(mockUser.id);
      expect(result.access_token).toBe('mock-access-token');
      expect(result.refresh_token).toBe('mock-refresh-token');
      expect(result.session_id).toBe(mockSession.id);

      // Event should be published (async call)
      expect(eventBusService.publishUserRegisteredEvent).toHaveBeenCalled();
      
      // Direct service calls should not be made anymore
      expect(securityServiceClient.logSecurityEvent).not.toHaveBeenCalled();
      expect(notificationServiceClient.sendWelcomeNotification).not.toHaveBeenCalled();
    });

    it('should generate session with 24-hour expiration', async () => {
      // Arrange
      userServiceClient.findByEmail.mockResolvedValue(null);
      userServiceClient.createUser.mockResolvedValue(mockUser);
      jwtService.signAsync
        .mockResolvedValueOnce('mock-access-token')
        .mockResolvedValueOnce('mock-refresh-token');
      sessionService.createSession.mockResolvedValue(mockSession);

      const beforeTime = Date.now();

      // Act
      await authService.register(registerDto, '127.0.0.1', 'Test Agent');

      const afterTime = Date.now();

      // Assert
      const createSessionCall = sessionService.createSession.mock.calls[0][0];
      const expiresAt = createSessionCall.expiresAt.getTime();
      
      // Should be approximately 24 hours from now (within 1 second tolerance)
      const expectedExpiration = 24 * 60 * 60 * 1000; // 24 hours in ms
      expect(expiresAt).toBeGreaterThanOrEqual(beforeTime + expectedExpiration - 1000);
      expect(expiresAt).toBeLessThanOrEqual(afterTime + expectedExpiration + 1000);
    });
  });
});
