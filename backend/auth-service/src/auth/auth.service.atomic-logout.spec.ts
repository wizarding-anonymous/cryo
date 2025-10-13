import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { TokenService } from '../token/token.service';
import { SessionService } from '../session/session.service';
import { UserServiceClient } from '../common/http-client/user-service.client';
import { SecurityServiceClient } from '../common/http-client/security-service.client';
import { NotificationServiceClient } from '../common/http-client/notification-service.client';
import { EventBusService } from '../events/services/event-bus.service';

describe('AuthService - Atomic Logout Operations', () => {
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

  beforeEach(() => {
    // Создаем моки напрямую
    jwtService = {
      signAsync: jest.fn(),
      verify: jest.fn(),
      decode: jest.fn(),
    } as any;

    tokenService = {
      blacklistToken: jest.fn().mockResolvedValue(undefined),
      removeFromBlacklist: jest.fn().mockResolvedValue(undefined),
      hashToken: jest.fn(),
    } as any;

    sessionService = {
      getSessionByAccessToken: jest.fn(),
      invalidateSession: jest.fn().mockResolvedValue(undefined),
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
    asyncOperations.executeParallel.mockImplementation(async (functions: (() => Promise<any>)[], _concurrency?: number) => {
      return Promise.all(functions.map(fn => fn()));
    });
  });

  describe('Atomic Logout with Compensating Transactions', () => {
    const mockAccessToken = 'mock.access.token';
    const mockRefreshToken = 'mock.refresh.token';
    const mockUserId = 'user-123';
    const mockIpAddress = '192.168.1.1';
    const mockSession = {
      id: 'session-123',
      userId: mockUserId,
      accessTokenHash: 'hashed-access-token',
      refreshTokenHash: 'hashed-refresh-token',
      ipAddress: mockIpAddress,
      userAgent: 'Test Agent',
      isActive: true,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
      lastAccessedAt: new Date(),
    };

    it('should successfully complete atomic logout when all operations succeed', async () => {
      // Arrange
      sessionService.getSessionByAccessToken.mockResolvedValue(mockSession);
      tokenService.blacklistToken.mockResolvedValue(undefined);
      sessionService.invalidateSession.mockResolvedValue(undefined);

      // Act
      await authService.logout(mockAccessToken, mockUserId, mockRefreshToken, mockIpAddress);

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert
      expect(tokenService.blacklistToken).toHaveBeenCalledTimes(2);
      expect(tokenService.blacklistToken).toHaveBeenNthCalledWith(1, mockAccessToken, mockUserId, 'logout');
      expect(tokenService.blacklistToken).toHaveBeenNthCalledWith(2, mockRefreshToken, mockUserId, 'logout');
      expect(sessionService.invalidateSession).toHaveBeenCalledWith(mockSession.id);
      expect(eventBusService.publishUserLoggedOutEvent).toHaveBeenCalled();
      expect(tokenService.removeFromBlacklist).not.toHaveBeenCalled(); // No rollback needed
    });

    it('should perform rollback when session invalidation fails after token blacklisting', async () => {
      // Arrange
      sessionService.getSessionByAccessToken.mockResolvedValue(mockSession);
      tokenService.blacklistToken.mockResolvedValue(undefined);
      sessionService.invalidateSession.mockRejectedValue(new Error('Database connection failed'));
      tokenService.removeFromBlacklist.mockResolvedValue(undefined);

      // Act & Assert
      await expect(
        authService.logout(mockAccessToken, mockUserId, mockRefreshToken, mockIpAddress)
      ).rejects.toThrow(InternalServerErrorException);

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Verify rollback was performed
      expect(tokenService.blacklistToken).toHaveBeenCalledTimes(2); // Both tokens blacklisted
      expect(tokenService.removeFromBlacklist).toHaveBeenCalledTimes(2); // Both tokens removed during rollback
      expect(tokenService.removeFromBlacklist).toHaveBeenNthCalledWith(1, mockAccessToken, mockUserId);
      expect(tokenService.removeFromBlacklist).toHaveBeenNthCalledWith(2, mockRefreshToken, mockUserId);
      expect(eventBusService.publishSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'logout_rollback',
          metadata: expect.objectContaining({
            rollbackReason: 'session_invalidation_failed',
            tokensRolledBack: 2,
            compensatingTransactionExecuted: true,
          }),
        })
      );
    });

    it('should handle partial rollback failure and log critical inconsistency', async () => {
      // Arrange
      sessionService.getSessionByAccessToken.mockResolvedValue(mockSession);
      tokenService.blacklistToken.mockResolvedValue(undefined);
      sessionService.invalidateSession.mockRejectedValue(new Error('Database connection failed'));
      tokenService.removeFromBlacklist
        .mockResolvedValueOnce(undefined) // First token rollback succeeds
        .mockRejectedValueOnce(new Error('Redis connection failed')); // Second token rollback fails

      // Act & Assert
      await expect(
        authService.logout(mockAccessToken, mockUserId, mockRefreshToken, mockIpAddress)
      ).rejects.toThrow(InternalServerErrorException);

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Verify partial rollback
      expect(tokenService.removeFromBlacklist).toHaveBeenCalledTimes(2);
      expect(eventBusService.publishSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'logout_rollback',
          metadata: expect.objectContaining({
            rollbackErrors: 1,
            rollbackErrorMessages: expect.arrayContaining([
              expect.stringContaining('Failed to remove token from blacklist during rollback')
            ]),
            consistencyMaintained: false,
          }),
        })
      );
    });

    it('should handle logout without refresh token', async () => {
      // Arrange
      sessionService.getSessionByAccessToken.mockResolvedValue(mockSession);
      tokenService.blacklistToken.mockResolvedValue(undefined);
      sessionService.invalidateSession.mockResolvedValue(undefined);

      // Act
      await authService.logout(mockAccessToken, mockUserId, undefined, mockIpAddress);

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert
      expect(tokenService.blacklistToken).toHaveBeenCalledTimes(1); // Only access token
      expect(tokenService.blacklistToken).toHaveBeenCalledWith(mockAccessToken, mockUserId, 'logout');
      expect(sessionService.invalidateSession).toHaveBeenCalledWith(mockSession.id);
      expect(eventBusService.publishUserLoggedOutEvent).toHaveBeenCalled();
    });

    it('should handle logout when session is not found', async () => {
      // Arrange
      sessionService.getSessionByAccessToken.mockResolvedValue(null);
      tokenService.blacklistToken.mockResolvedValue(undefined);

      // Act
      await authService.logout(mockAccessToken, mockUserId, mockRefreshToken, mockIpAddress);

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert
      expect(tokenService.blacklistToken).toHaveBeenCalledTimes(2);
      expect(sessionService.invalidateSession).not.toHaveBeenCalled(); // No session to invalidate
      expect(eventBusService.publishUserLoggedOutEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'unknown',
        })
      );
    });

    it('should throw BadRequestException when access token is missing', async () => {
      // Act & Assert
      await expect(
        authService.logout('', mockUserId, mockRefreshToken, mockIpAddress)
      ).rejects.toThrow(BadRequestException);

      await expect(
        authService.logout(null as any, mockUserId, mockRefreshToken, mockIpAddress)
      ).rejects.toThrow(BadRequestException);

      // Verify no operations were performed
      expect(tokenService.blacklistToken).not.toHaveBeenCalled();
      expect(sessionService.invalidateSession).not.toHaveBeenCalled();
    });

    it('should maintain operation order: blacklist tokens first, then invalidate session', async () => {
      // Arrange
      const operationOrder: string[] = [];
      
      sessionService.getSessionByAccessToken.mockResolvedValue(mockSession);
      tokenService.blacklistToken.mockImplementation(async (token: string) => {
        operationOrder.push(`blacklist_${token === mockAccessToken ? 'access' : 'refresh'}`);
      });
      sessionService.invalidateSession.mockImplementation(async () => {
        operationOrder.push('invalidate_session');
      });

      // Act
      await authService.logout(mockAccessToken, mockUserId, mockRefreshToken, mockIpAddress);

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert correct order
      expect(operationOrder).toEqual([
        'blacklist_access',
        'blacklist_refresh',
        'invalidate_session'
      ]);
    });

    it('should handle concurrent logout attempts with proper error handling', async () => {
      // Arrange
      sessionService.getSessionByAccessToken.mockResolvedValue(mockSession);
      tokenService.blacklistToken.mockResolvedValue(undefined);
      sessionService.invalidateSession.mockRejectedValue(new Error('Session already invalidated'));
      tokenService.removeFromBlacklist.mockResolvedValue(undefined);

      // Act - Simulate concurrent logout attempts
      const logoutPromises = [
        authService.logout(mockAccessToken, mockUserId, mockRefreshToken, mockIpAddress),
        authService.logout(mockAccessToken, mockUserId, mockRefreshToken, mockIpAddress),
      ];

      // Assert
      await expect(Promise.all(logoutPromises)).rejects.toThrow();
      
      // Verify rollback was attempted for failed operations
      expect(tokenService.removeFromBlacklist).toHaveBeenCalled();
    });

    it('should log detailed information for monitoring and debugging', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      sessionService.getSessionByAccessToken.mockResolvedValue(mockSession);
      tokenService.blacklistToken.mockResolvedValue(undefined);
      sessionService.invalidateSession.mockResolvedValue(undefined);

      // Act
      await authService.logout(mockAccessToken, mockUserId, mockRefreshToken, mockIpAddress);

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert that success logging occurred
      // Note: In real implementation, we'd use a proper logger service
      // This test verifies the logging structure is in place
      expect(eventBusService.publishUserLoggedOutEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          sessionId: mockSession.id,
          ipAddress: mockIpAddress,
          reason: 'manual',
          timestamp: expect.any(Date),
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    const mockAccessToken = 'mock.access.token';
    const mockUserId = 'user-123';

    it('should handle token blacklisting failure before session operations', async () => {
      // Arrange
      sessionService.getSessionByAccessToken.mockResolvedValue(null);
      tokenService.blacklistToken.mockRejectedValue(new Error('Redis unavailable'));

      // Act & Assert
      await expect(
        authService.logout(mockAccessToken, mockUserId)
      ).rejects.toThrow('Redis unavailable');

      // Verify no session operations were attempted
      expect(sessionService.invalidateSession).not.toHaveBeenCalled();
      expect(tokenService.removeFromBlacklist).not.toHaveBeenCalled();
    });

    it('should handle rollback failure gracefully and continue with error reporting', async () => {
      // Arrange
      const mockSession = {
        id: 'session-123',
        userId: mockUserId,
        accessTokenHash: 'hashed-access-token',
        refreshTokenHash: 'hashed-refresh-token',
        ipAddress: '192.168.1.1',
        userAgent: 'Test Agent',
        isActive: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };
      sessionService.getSessionByAccessToken.mockResolvedValue(mockSession);
      tokenService.blacklistToken.mockResolvedValue(undefined);
      sessionService.invalidateSession.mockRejectedValue(new Error('Session error'));
      tokenService.removeFromBlacklist.mockRejectedValue(new Error('Rollback failed'));

      // Act & Assert
      await expect(
        authService.logout(mockAccessToken, mockUserId)
      ).rejects.toThrow(InternalServerErrorException);

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Verify security event was published despite rollback failure
      expect(eventBusService.publishSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'logout_rollback',
          metadata: expect.objectContaining({
            rollbackErrors: 1,
            consistencyMaintained: false,
          }),
        })
      );
    });
  });
});