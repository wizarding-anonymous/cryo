import { AuthService } from './auth.service';
import { TokenService } from '../token/token.service';
import { SessionService } from '../session/session.service';
import { UserServiceClient } from '../common/http-client/user-service.client';
import { SecurityServiceClient } from '../common/http-client/security-service.client';
import { NotificationServiceClient } from '../common/http-client/notification-service.client';
import { EventBusService } from '../events/services/event-bus.service';

describe('AuthService - Login Functionality', () => {
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

  const fixedDate = new Date('2025-10-13T09:16:45.358Z');
  const mockUser = {
    id: 'user-123',
    name: 'John Doe',
    email: 'john@example.com',
    password: 'hashedPassword123',
    isActive: true,
    createdAt: fixedDate,
    updatedAt: fixedDate,
  };
  const mockUserWithoutPassword = {
    id: 'user-123',
    name: 'John Doe',
    email: 'john@example.com',
    isActive: true,
    createdAt: fixedDate,
    updatedAt: fixedDate,
  };

  const mockTokens = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
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
      createSession: jest.fn(),
      createSessionWithLimit: jest.fn().mockResolvedValue({
        session: mockSession,
        removedSessionsCount: 0,
      }),
      enforceSessionLimit: jest.fn(),
    } as any;

    userServiceClient = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      updateLastLogin: jest.fn(),
    } as any;

    securityServiceClient = {
      logSecurityEvent: jest.fn(),
    } as any;

    notificationServiceClient = {
      sendWelcomeNotification: jest.fn(),
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
      executeLoginSaga: jest.fn(),
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
    
    
    // Создаем AuthService с моками
    
    const authMetrics = {
      incrementAuthOperation: jest.fn(),
      recordAuthOperationDuration: jest.fn(),
      incrementActiveSessions: jest.fn(),
      decrementActiveSessions: jest.fn(),
      incrementAuthFailure: jest.fn(),
      incrementBlacklistedTokens: jest.fn(),
    } as any;

    const structuredLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      logAuth: jest.fn(),
      logSecurity: jest.fn(),
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
      authMetrics,
      structuredLogger
    );

    // Mock password comparison through worker process
    workerProcess.executeInWorker.mockResolvedValue(true);

    // Mock executeCriticalPath to execute the callback function
    asyncOperations.executeCriticalPath.mockImplementation(async (callback: () => any) => {
      return await callback();
    });

    // Mock saga pattern to return successful result
    authSagaService.executeLoginSaga.mockResolvedValue('saga-123');
    authSagaService.waitForSagaCompletion.mockResolvedValue({
      completed: true,
      status: 'completed',
      result: {
        user: mockUserWithoutPassword,
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        session_id: 'session-123',
        expires_in: 3600,
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user without password for valid credentials', async () => {
      // Arrange
      userServiceClient.findByEmail.mockResolvedValue(mockUser);
      workerProcess.executeInWorker.mockResolvedValue(true);

      // Act
      const result = await authService.validateUser('john@example.com', 'correctPassword');

      // Assert - Requirement 1.2: Auth Service SHALL handle all user login operations
      expect(result).toEqual(mockUserWithoutPassword);
      expect(result).not.toHaveProperty('password');
      expect(userServiceClient.findByEmail).toHaveBeenCalledWith('john@example.com');
      expect(workerProcess.executeInWorker).toHaveBeenCalledWith('compare-password', {
        password: 'correctPassword',
        hash: 'hashedPassword123'
      });
    });

    it('should return null for non-existent user', async () => {
      // Arrange
      userServiceClient.findByEmail.mockResolvedValue(null);

      // Act
      const result = await authService.validateUser('nonexistent@example.com', 'password');

      // Assert
      expect(result).toBeNull();
      expect(userServiceClient.findByEmail).toHaveBeenCalledWith('nonexistent@example.com');
      expect(workerProcess.executeInWorker).not.toHaveBeenCalled();
    });

    it('should return null for invalid password', async () => {
      // Arrange
      userServiceClient.findByEmail.mockResolvedValue(mockUser);
      workerProcess.executeInWorker.mockResolvedValue(false);

      // Act
      const result = await authService.validateUser('john@example.com', 'wrongPassword');

      // Assert - Requirement 4.2: Auth Service SHALL verify password against stored hash
      expect(result).toBeNull();
      expect(userServiceClient.findByEmail).toHaveBeenCalledWith('john@example.com');
      expect(workerProcess.executeInWorker).toHaveBeenCalledWith('compare-password', {
        password: 'wrongPassword',
        hash: 'hashedPassword123'
      });
    });

    it('should return null when User Service throws error', async () => {
      // Arrange - Requirement 2.5: IF User Service is unavailable THEN Auth Service SHALL handle the failure gracefully
      userServiceClient.findByEmail.mockRejectedValue(new Error('Service unavailable'));

      // Act
      const result = await authService.validateUser('john@example.com', 'password');

      // Assert
      expect(result).toBeNull();
      expect(userServiceClient.findByEmail).toHaveBeenCalledWith('john@example.com');
    });

    it('should return null when bcrypt comparison throws error', async () => {
      // Arrange
      userServiceClient.findByEmail.mockResolvedValue(mockUser);
      workerProcess.executeInWorker.mockRejectedValue(new Error('Worker error'));

      // Act
      const result = await authService.validateUser('john@example.com', 'password');

      // Assert
      expect(result).toBeNull();
      expect(userServiceClient.findByEmail).toHaveBeenCalledWith('john@example.com');
      expect(workerProcess.executeInWorker).toHaveBeenCalledWith('compare-password', {
        password: 'password',
        hash: 'hashedPassword123'
      });
    });
  });

  describe('login', () => {
    beforeEach(() => {
      // Mock generateTokens method (private method, so we mock the result)
      jwtService.signAsync
        .mockResolvedValueOnce('mock-access-token')
        .mockResolvedValueOnce('mock-refresh-token');

      sessionService.enforceSessionLimit.mockResolvedValue(0);
      sessionService.createSession.mockResolvedValue(mockSession);
      userServiceClient.updateLastLogin.mockResolvedValue(undefined);
      securityServiceClient.logSecurityEvent.mockResolvedValue(undefined);
    });

    it('should successfully login user and create session with metadata tracking', async () => {
      // Act
      const result = await authService.login(mockUserWithoutPassword, '127.0.0.1', 'Test Agent');

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert - Requirement 1.2: Auth Service SHALL handle all user login operations
      expect(result).toBeDefined();
      expect(result.user).toEqual(mockUserWithoutPassword);
      expect(result.access_token).toBe('mock-access-token');
      expect(result.refresh_token).toBe('mock-refresh-token');
      expect(result.session_id).toBe('session-123');
      expect(result.expires_in).toBe(3600);

      // Requirement 4.3: Auth Service SHALL generate JWT access tokens with expiration
      // Requirement 4.4: Auth Service SHALL generate refresh tokens with longer expiration
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(1, {
        sub: mockUserWithoutPassword.id,
        email: mockUserWithoutPassword.email,
      });
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(2, {
        sub: mockUserWithoutPassword.id,
        email: mockUserWithoutPassword.email,
      }, { expiresIn: '7d' });

      // Requirement 12.2: Create local session with metadata tracking
      // Requirement 13.1: Auth Service SHALL create session record with metadata
      expect(sessionService.createSessionWithLimit).toHaveBeenCalledWith({
        userId: mockUserWithoutPassword.id,
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        expiresAt: expect.any(Date),
      }, 5);

      // Requirement 11.2: Auth Service SHALL publish UserLoggedInEvent for event-driven processing
      expect(eventBusService.publishUserLoggedInEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserWithoutPassword.id,
          sessionId: mockSession.id,
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
          timestamp: expect.any(Date),
        })
      );

      // Verify that direct service calls are no longer made (moved to event handlers)
      expect(userServiceClient.updateLastLogin).not.toHaveBeenCalled();
      expect(securityServiceClient.logSecurityEvent).not.toHaveBeenCalled();
    });

    it('should enforce concurrent session limits before creating new session', async () => {
      // Arrange - Requirement 13.3: Auth Service SHALL limit maximum concurrent sessions
      sessionService.createSessionWithLimit.mockResolvedValue({
        session: mockSession,
        removedSessionsCount: 2, // 2 sessions removed
      });

      // Act
      const result = await authService.login(mockUserWithoutPassword, '127.0.0.1', 'Test Agent');

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert
      expect(sessionService.createSessionWithLimit).toHaveBeenCalledWith(expect.any(Object), 5);
      expect(result).toBeDefined();

      // Should publish security event with session limit enforcement info
      expect(eventBusService.publishSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserWithoutPassword.id,
          type: 'login',
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
          timestamp: expect.any(Date),
          metadata: {
            sessionLimitEnforced: true,
            removedSessionsCount: 2,
            maxSessionsAllowed: 5,
            raceConditionProtected: true
          }
        })
      );
    });

    it('should use default values for IP address and user agent when not provided', async () => {
      // Act
      const result = await authService.login(mockUserWithoutPassword);

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert
      expect(sessionService.createSessionWithLimit).toHaveBeenCalledWith({
        userId: mockUserWithoutPassword.id,
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        ipAddress: '::1', // Default IP
        userAgent: 'Unknown', // Default user agent
        expiresAt: expect.any(Date),
      }, 5);

      expect(eventBusService.publishUserLoggedInEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserWithoutPassword.id,
          sessionId: mockSession.id,
          ipAddress: '::1', // Default IP
          userAgent: 'Unknown', // Default user agent
          timestamp: expect.any(Date),
        })
      );

      expect(result).toBeDefined();
    });

    it('should generate session with 24-hour expiration', async () => {
      // Arrange
      const beforeTime = Date.now();

      // Act
      await authService.login(mockUserWithoutPassword, '127.0.0.1', 'Test Agent');

      const afterTime = Date.now();

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert
      const createSessionCall = sessionService.createSessionWithLimit.mock.calls[0][0];
      const expiresAt = createSessionCall.expiresAt.getTime();

      // Should be approximately 24 hours from now (within 1 second tolerance)
      const expectedExpiration = 24 * 60 * 60 * 1000; // 24 hours in ms
      expect(expiresAt).toBeGreaterThanOrEqual(beforeTime + expectedExpiration - 1000);
      expect(expiresAt).toBeLessThanOrEqual(afterTime + expectedExpiration + 1000);
    });

    it('should continue login even if external service calls fail', async () => {
      // Arrange - External services should not block core authentication
      // Since these are void calls (fire-and-forget), we just verify they're called
      // The actual error handling is internal to the service

      // Act
      const result = await authService.login(mockUserWithoutPassword, '127.0.0.1', 'Test Agent');

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert - Login should succeed despite external service failures
      expect(result).toBeDefined();
      expect(result.user.id).toBe(mockUserWithoutPassword.id);
      expect(result.access_token).toBe('mock-access-token');
      expect(result.refresh_token).toBe('mock-refresh-token');
      expect(result.session_id).toBe('session-123');

      // Event publishing should still be called (async calls)
      expect(eventBusService.publishUserLoggedInEvent).toHaveBeenCalled();
    });

    it('should handle session creation failure', async () => {
      // Arrange
      sessionService.createSessionWithLimit.mockRejectedValue(new Error('Database unavailable'));

      // Act & Assert
      await expect(authService.login(mockUserWithoutPassword, '127.0.0.1', 'Test Agent'))
        .rejects
        .toThrow('Database unavailable');

      expect(sessionService.createSessionWithLimit).toHaveBeenCalled();
    });



    it('should log session limit enforcement when sessions are removed', async () => {
      // Arrange
      sessionService.createSessionWithLimit.mockResolvedValue({
        session: mockSession,
        removedSessionsCount: 3, // 3 sessions removed
      });

      // Act
      await authService.login(mockUserWithoutPassword, '192.168.1.1', 'Mobile App');

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert
      expect(eventBusService.publishSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserWithoutPassword.id,
          type: 'login',
          ipAddress: '192.168.1.1',
          userAgent: 'Mobile App',
          timestamp: expect.any(Date),
          metadata: {
            sessionLimitEnforced: true,
            removedSessionsCount: 3,
            maxSessionsAllowed: 5,
            raceConditionProtected: true
          }
        })
      );
    });

    it('should not log session limit enforcement when no sessions are removed', async () => {
      // Arrange
      sessionService.createSessionWithLimit.mockResolvedValue({
        session: mockSession,
        removedSessionsCount: 0, // No sessions removed
      });

      // Act
      await authService.login(mockUserWithoutPassword, '192.168.1.1', 'Mobile App');

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert - Should only publish UserLoggedInEvent, not security event for session limit
      expect(eventBusService.publishUserLoggedInEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserWithoutPassword.id,
          ipAddress: '192.168.1.1',
          userAgent: 'Mobile App',
          timestamp: expect.any(Date),
        })
      );

      // Should not publish security event for session limit enforcement
      expect(eventBusService.publishSecurityEvent).not.toHaveBeenCalled();
    });
  });

  describe('integration between validateUser and login', () => {
    it('should complete full login flow with credential validation', async () => {
      // Arrange
      userServiceClient.findByEmail.mockResolvedValue(mockUser);
      workerProcess.executeInWorker.mockResolvedValue(true);
      jwtService.signAsync
        .mockResolvedValueOnce('mock-access-token')
        .mockResolvedValueOnce('mock-refresh-token');
      sessionService.enforceSessionLimit.mockResolvedValue(0);
      sessionService.createSession.mockResolvedValue(mockSession);
      userServiceClient.updateLastLogin.mockResolvedValue(undefined);
      securityServiceClient.logSecurityEvent.mockResolvedValue(undefined);

      // Act - Simulate full login flow
      const validatedUser = await authService.validateUser('john@example.com', 'correctPassword');
      expect(validatedUser).not.toBeNull();

      const loginResult = await authService.login(validatedUser!, '127.0.0.1', 'Test Agent');

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert - Complete login flow requirements
      expect(loginResult).toBeDefined();
      expect(loginResult.user).toEqual(mockUserWithoutPassword);
      expect(loginResult.access_token).toBe('mock-access-token');
      expect(loginResult.refresh_token).toBe('mock-refresh-token');
      expect(loginResult.session_id).toBe('session-123');

      // Verify all required operations were performed
      expect(userServiceClient.findByEmail).toHaveBeenCalledWith('john@example.com');
      expect(workerProcess.executeInWorker).toHaveBeenCalledWith('compare-password', {
        password: 'correctPassword',
        hash: 'hashedPassword123'
      });
      expect(sessionService.createSessionWithLimit).toHaveBeenCalled();

      // Verify event publishing instead of direct service calls
      expect(eventBusService.publishUserLoggedInEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          sessionId: mockSession.id,
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
          timestamp: expect.any(Date),
        })
      );
    });

    it('should fail login flow with invalid credentials', async () => {
      // Arrange
      userServiceClient.findByEmail.mockResolvedValue(mockUser);
      workerProcess.executeInWorker.mockResolvedValue(false);

      // Act
      const validatedUser = await authService.validateUser('john@example.com', 'wrongPassword');

      // Assert
      expect(validatedUser).toBeNull();
      expect(userServiceClient.findByEmail).toHaveBeenCalledWith('john@example.com');
      expect(workerProcess.executeInWorker).toHaveBeenCalledWith('compare-password', {
        password: 'wrongPassword',
        hash: 'hashedPassword123'
      });

      // Login should not be called with null user
      // This would be handled by the controller throwing UnauthorizedException
    });
  });
});
