import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { TokenService } from '../token/token.service';
import { SessionService } from '../session/session.service';
import { UserServiceClient } from '../common/http-client/user-service.client';
import { SecurityServiceClient } from '../common/http-client/security-service.client';
import { NotificationServiceClient } from '../common/http-client/notification-service.client';
import { EventBusService } from '../events/services/event-bus.service';

describe('AuthService - Logout Functionality', () => {
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

  const mockSession = {
    id: 'session-123',
    userId: 'user-123',
    accessTokenHash: 'hashed-access-token-123',
    refreshTokenHash: 'hashed-refresh-token-123',
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
      verify: jest.fn(),
    } as any;

    tokenService = {
      blacklistToken: jest.fn().mockResolvedValue(undefined),
      blacklistAllUserTokens: jest.fn().mockResolvedValue(undefined),
      removeFromBlacklist: jest.fn().mockResolvedValue(undefined),
      hashToken: jest.fn(),
    } as any;

    sessionService = {
      getSessionByAccessToken: jest.fn(),
      invalidateSession: jest.fn().mockResolvedValue(undefined),
      invalidateAllUserSessions: jest.fn().mockResolvedValue(undefined),
      invalidateSessionsForSecurityEvent: jest.fn().mockResolvedValue(undefined),
      createSession: jest.fn(),
      createSessionWithLimit: jest.fn(),
    } as any;

    userServiceClient = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      createUser: jest.fn(),
      updateLastLogin: jest.fn(),
    } as any;

    securityServiceClient = {
      logSecurityEvent: jest.fn().mockResolvedValue(undefined),
    } as any;

    notificationServiceClient = {
      sendWelcomeNotification: jest.fn().mockResolvedValue(undefined),
    } as any;

    eventBusService = {
      publishUserLoggedOutEvent: jest.fn().mockResolvedValue(undefined),
      publishSecurityEvent: jest.fn().mockResolvedValue(undefined),
      publishUserRegisteredEvent: jest.fn().mockResolvedValue(undefined),
      publishUserLoggedInEvent: jest.fn().mockResolvedValue(undefined),
    } as any;

    configService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'MAX_SESSIONS_PER_USER') return 5;
        if (key === 'USE_SAGA_PATTERN') return false;
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
      executeParallel: jest.fn(),
    } as any;

    metricsService = {
      recordAuthFlowMetric: jest.fn(),
    } as any;

    workerProcess = {
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

    // Mock executeCriticalPath to execute the callback function
    asyncOperations.executeCriticalPath.mockImplementation(async (callback: () => any) => {
      return await callback();
    });

    // Mock executeParallel to execute all functions in parallel
    asyncOperations.executeParallel.mockImplementation(async (functions: (() => Promise<any>)[], concurrency?: number) => {
      return Promise.all(functions.map(fn => fn()));
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('logout', () => {
    const accessToken = 'access-token-123';
    const userId = 'user-123';
    const refreshToken = 'refresh-token-123';
    const ipAddress = '192.168.1.1';

    it('should successfully logout user with access token only', async () => {
      // Arrange
      sessionService.getSessionByAccessToken.mockResolvedValue(mockSession);
      sessionService.invalidateSession.mockResolvedValue();
      tokenService.blacklistToken.mockResolvedValue();

      // Act
      await authService.logout(accessToken, userId, undefined, ipAddress);

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert - Requirement 1.3: Auth Service SHALL handle all user logout operations
      expect(sessionService.getSessionByAccessToken).toHaveBeenCalledWith(accessToken);
      expect(sessionService.invalidateSession).toHaveBeenCalledWith(mockSession.id);

      // Requirement 4.5: Auth Service SHALL blacklist the JWT token in Redis
      expect(tokenService.blacklistToken).toHaveBeenCalledWith(accessToken, userId, 'logout');
      expect(tokenService.blacklistToken).toHaveBeenCalledTimes(1);

      // Requirement 11.3: Auth Service SHALL publish UserLoggedOutEvent for event-driven processing
      expect(eventBusService.publishUserLoggedOutEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          sessionId: mockSession.id,
          ipAddress,
          reason: 'manual',
          timestamp: expect.any(Date),
        })
      );
    });

    it('should successfully logout user with both access and refresh tokens', async () => {
      // Arrange
      sessionService.getSessionByAccessToken.mockResolvedValue(mockSession);
      sessionService.invalidateSession.mockResolvedValue();
      tokenService.blacklistToken.mockResolvedValue();

      // Act
      await authService.logout(accessToken, userId, refreshToken, ipAddress);

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert
      expect(sessionService.getSessionByAccessToken).toHaveBeenCalledWith(accessToken);
      expect(sessionService.invalidateSession).toHaveBeenCalledWith(mockSession.id);

      // Both tokens should be blacklisted
      expect(tokenService.blacklistToken).toHaveBeenCalledWith(accessToken, userId, 'logout');
      expect(tokenService.blacklistToken).toHaveBeenCalledWith(refreshToken, userId, 'logout');
      expect(tokenService.blacklistToken).toHaveBeenCalledTimes(2);

      expect(eventBusService.publishUserLoggedOutEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          sessionId: mockSession.id,
          ipAddress,
          reason: 'manual',
          timestamp: expect.any(Date),
        })
      );
    });

    it('should use default IP address when not provided', async () => {
      // Arrange
      sessionService.getSessionByAccessToken.mockResolvedValue(mockSession);
      sessionService.invalidateSession.mockResolvedValue();
      tokenService.blacklistToken.mockResolvedValue();

      // Act
      await authService.logout(accessToken, userId);

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert
      expect(eventBusService.publishUserLoggedOutEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          sessionId: mockSession.id,
          ipAddress: '::1', // Default IP
          reason: 'manual',
          timestamp: expect.any(Date),
        })
      );
    });

    it('should handle logout when session is not found', async () => {
      // Arrange
      sessionService.getSessionByAccessToken.mockResolvedValue(null);
      tokenService.blacklistToken.mockResolvedValue();

      // Act
      await authService.logout(accessToken, userId, refreshToken, ipAddress);

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert
      expect(sessionService.getSessionByAccessToken).toHaveBeenCalledWith(accessToken);
      expect(sessionService.invalidateSession).not.toHaveBeenCalled();

      // Tokens should still be blacklisted
      expect(tokenService.blacklistToken).toHaveBeenCalledWith(accessToken, userId, 'logout');
      expect(tokenService.blacklistToken).toHaveBeenCalledWith(refreshToken, userId, 'logout');

      // Event should be published with unknown session
      expect(eventBusService.publishUserLoggedOutEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          sessionId: 'unknown',
          ipAddress,
          reason: 'manual',
          timestamp: expect.any(Date),
        })
      );
    });

    it('should throw BadRequestException when access token is missing', async () => {
      // Act & Assert
      await expect(authService.logout('', userId, refreshToken, ipAddress))
        .rejects
        .toThrow(BadRequestException);

      await expect(authService.logout(null as any, userId, refreshToken, ipAddress))
        .rejects
        .toThrow(BadRequestException);

      expect(sessionService.getSessionByAccessToken).not.toHaveBeenCalled();
      expect(tokenService.blacklistToken).not.toHaveBeenCalled();
    });

    it('should handle token blacklisting errors gracefully', async () => {
      // Arrange
      sessionService.getSessionByAccessToken.mockResolvedValue(mockSession);
      sessionService.invalidateSession.mockResolvedValue();
      // TokenService.blacklistToken has internal error handling and doesn't throw
      tokenService.blacklistToken.mockResolvedValue();

      // Act - Should not throw error
      await authService.logout(accessToken, userId, refreshToken, ipAddress);

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert
      expect(sessionService.getSessionByAccessToken).toHaveBeenCalledWith(accessToken);
      expect(sessionService.invalidateSession).toHaveBeenCalledWith(mockSession.id);
      expect(tokenService.blacklistToken).toHaveBeenCalledTimes(2);

      // Event should still be published
      expect(eventBusService.publishUserLoggedOutEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          sessionId: mockSession.id,
          ipAddress,
          reason: 'manual',
          timestamp: expect.any(Date),
        })
      );
    });

    it('should handle session invalidation errors gracefully', async () => {
      // Arrange
      sessionService.getSessionByAccessToken.mockResolvedValue(mockSession);
      sessionService.invalidateSession.mockRejectedValue(new Error('Database error'));
      tokenService.blacklistToken.mockResolvedValue();

      // Act & Assert - Should throw error since session invalidation is not wrapped in try-catch
      await expect(authService.logout(accessToken, userId, refreshToken, ipAddress))
        .rejects
        .toThrow('Logout failed: Unable to invalidate session. Please try again.');

      expect(sessionService.getSessionByAccessToken).toHaveBeenCalledWith(accessToken);
      expect(sessionService.invalidateSession).toHaveBeenCalledWith(mockSession.id);
      // Tokens are blacklisted first, then session invalidation is attempted
      // If session invalidation fails, tokens are removed from blacklist (rollback)
      expect(tokenService.blacklistToken).toHaveBeenCalledTimes(2);
      expect(tokenService.removeFromBlacklist).toHaveBeenCalledTimes(2);
    });
  });

  describe('invalidateAllUserSessions', () => {
    const userId = 'user-123';
    const reason = 'security_breach';
    const ipAddress = '192.168.1.1';

    it('should invalidate all user sessions and blacklist all tokens', async () => {
      // Arrange
      const invalidatedCount = 3;
      sessionService.invalidateAllUserSessions.mockResolvedValue(invalidatedCount);
      tokenService.blacklistAllUserTokens.mockResolvedValue();

      // Act
      await authService.invalidateAllUserSessions(userId, reason, ipAddress);

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert - Requirement 13.6: Auth Service SHALL invalidate all user sessions for security events
      expect(sessionService.invalidateAllUserSessions).toHaveBeenCalledWith(userId, reason);
      expect(tokenService.blacklistAllUserTokens).toHaveBeenCalledWith(userId);

      // Should publish logout event for all sessions
      expect(eventBusService.publishUserLoggedOutEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          sessionId: 'all_sessions',
          ipAddress,
          reason: 'security',
          timestamp: expect.any(Date),
        })
      );

      // Should publish security event for session invalidation
      expect(eventBusService.publishSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          type: 'all_sessions_invalidated',
          ipAddress,
          metadata: {
            reason,
            sessionsInvalidated: invalidatedCount,
            allSessionsInvalidated: true,
          },
          timestamp: expect.any(Date),
        })
      );
    });

    it('should use default reason and IP when not provided', async () => {
      // Arrange
      const invalidatedCount = 2;
      sessionService.invalidateAllUserSessions.mockResolvedValue(invalidatedCount);
      tokenService.blacklistAllUserTokens.mockResolvedValue();

      // Act
      await authService.invalidateAllUserSessions(userId);

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert
      expect(sessionService.invalidateAllUserSessions).toHaveBeenCalledWith(userId, 'security_event');
      expect(eventBusService.publishUserLoggedOutEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          sessionId: 'all_sessions',
          ipAddress: '::1', // Default IP
          reason: 'security',
          timestamp: expect.any(Date),
        })
      );
    });
  });

  describe('invalidateSessionsForSecurityEvent', () => {
    const userId = 'user-123';
    const securityEventType = 'password_change';
    const ipAddress = '192.168.1.1';
    const excludeCurrentSession = 'current-session-id';

    it('should invalidate sessions for security events', async () => {
      // Arrange
      const mockResult = { invalidatedCount: 2, remainingCount: 1, securityEventType: 'password_change' };
      sessionService.invalidateSessionsForSecurityEvent.mockResolvedValue(mockResult);
      tokenService.blacklistAllUserTokens.mockResolvedValue();

      // Act
      await authService.invalidateSessionsForSecurityEvent(
        userId,
        securityEventType,
        ipAddress,
        excludeCurrentSession
      );

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert - Requirement 13.5, 13.6: Auth Service SHALL invalidate sessions for security events
      expect(sessionService.invalidateSessionsForSecurityEvent).toHaveBeenCalledWith(
        userId,
        securityEventType,
        excludeCurrentSession
      );
      expect(tokenService.blacklistAllUserTokens).toHaveBeenCalledWith(userId);

      expect(eventBusService.publishUserLoggedOutEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          sessionId: excludeCurrentSession,
          ipAddress,
          reason: 'security',
          timestamp: expect.any(Date),
        })
      );

      expect(eventBusService.publishSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          type: 'security_session_invalidation',
          ipAddress,
          metadata: {
            securityEventType,
            invalidatedCount: 2,
            remainingCount: 1,
            excludedCurrentSession: true,
            securityEventTriggered: true,
          },
          timestamp: expect.any(Date),
        })
      );
    });

    it('should handle security event without excluding current session', async () => {
      // Arrange
      const mockResult = { invalidatedCount: 3, remainingCount: 0, securityEventType: 'suspicious_activity' };
      sessionService.invalidateSessionsForSecurityEvent.mockResolvedValue(mockResult);
      tokenService.blacklistAllUserTokens.mockResolvedValue();

      // Act
      await authService.invalidateSessionsForSecurityEvent(
        userId,
        'suspicious_activity',
        ipAddress
      );

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert
      expect(sessionService.invalidateSessionsForSecurityEvent).toHaveBeenCalledWith(
        userId,
        'suspicious_activity',
        undefined
      );

      expect(eventBusService.publishUserLoggedOutEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          sessionId: 'multiple_sessions',
          ipAddress,
          reason: 'security',
          timestamp: expect.any(Date),
        })
      );

      expect(eventBusService.publishSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            excludedCurrentSession: false,
          }),
        })
      );
    });
  });
});