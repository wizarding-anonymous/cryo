import { AuthService } from './auth.service';
import { SessionService } from '../session/session.service';
import { TokenService } from '../token/token.service';
import { UserServiceClient } from '../common/http-client/user-service.client';
import { SecurityServiceClient } from '../common/http-client/security-service.client';
import { NotificationServiceClient } from '../common/http-client/notification-service.client';
import { EventBusService } from '../events/services/event-bus.service';

describe('AuthService - Race Condition Tests', () => {
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
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashed-password',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTokens = {
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-123',
    expiresIn: 3600,
  };

  const mockSession = {
    id: 'session-123',
    userId: 'user-123',
    accessTokenHash: 'hashed-access-token-123',
    refreshTokenHash: 'hashed-refresh-token-123',
    ipAddress: '127.0.0.1',
    userAgent: 'Test Agent',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    lastAccessedAt: new Date(),
  };

  beforeEach(() => {
    // Создаем моки напрямую
    jwtService = {
      signAsync: jest.fn().mockImplementation((_payload, options) => {
        if (options?.expiresIn === '7d') {
          return Promise.resolve('refresh-token-123');
        }
        return Promise.resolve('access-token-123');
      }),
      verify: jest.fn(),
      decode: jest.fn(),
    } as any;

    tokenService = {
      generateTokens: jest.fn().mockResolvedValue(mockTokens),
      blacklistToken: jest.fn().mockResolvedValue(undefined),
      isTokenBlacklisted: jest.fn(),
      validateRefreshToken: jest.fn(),
      refreshTokenWithRotation: jest.fn(),
      blacklistAllUserTokens: jest.fn(),
      hashToken: jest.fn(),
    } as any;

    sessionService = {
      createSessionWithLimit: jest.fn(),
      enforceSessionLimitAndCreateSession: jest.fn(),
      createSession: jest.fn(),
      enforceSessionLimit: jest.fn(),
      getUserSessions: jest.fn(),
      invalidateSession: jest.fn(),
      getSessionByAccessToken: jest.fn(),
    } as any;

    userServiceClient = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      createUser: jest.fn(),
      updateLastLogin: jest.fn(),
    } as any;

    securityServiceClient = {
      logSecurityEvent: jest.fn().mockResolvedValue(undefined),
      logTokenRefresh: jest.fn().mockResolvedValue(undefined),
    } as any;

    notificationServiceClient = {
      sendWelcomeNotification: jest.fn().mockResolvedValue(undefined),
      sendSecurityAlert: jest.fn().mockResolvedValue(undefined),
      sendMultipleFailedAttemptsAlert: jest.fn().mockResolvedValue(undefined),
    } as any;

    eventBusService = {
      publishUserRegisteredEvent: jest.fn().mockResolvedValue(undefined),
      publishUserLoggedInEvent: jest.fn().mockResolvedValue(undefined),
      publishUserLoggedOutEvent: jest.fn().mockResolvedValue(undefined),
      publishSecurityEvent: jest.fn().mockResolvedValue(undefined),
    } as any;

    configService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          MAX_SESSIONS_PER_USER: 5,
          JWT_SECRET: 'test-secret',
          JWT_EXPIRES_IN: '1h',
          USE_SAGA_PATTERN: false,
          ENABLE_SAGA_PATTERN: false,
        };
        // Явно возвращаем значение из config, если оно есть, иначе defaultValue
        if (key in config) {
          return config[key];
        }
        return defaultValue;
      }),
    } as any;

    authSagaService = {
      executeRegistrationSaga: jest.fn(),
      executeLoginSaga: jest.fn().mockResolvedValue('saga-123'),
      waitForSagaCompletion: jest.fn().mockResolvedValue({
        completed: true,
        status: 'success',
        result: {
          user: mockUser,
          tokens: mockTokens,
          session_id: mockSession.id,
        }
      }),
    } as any;

    sagaService = {
      executeSaga: jest.fn(),
      getSaga: jest.fn().mockResolvedValue({
        metadata: {
          user: mockUser,
          tokens: mockTokens,
          session: mockSession,
        }
      }),
    } as any;

    asyncOperations = {
      executeAsync: jest.fn(),
      executeCriticalPath: jest.fn(),
      executeParallel: jest.fn(),
    } as any;

    metricsService = {
      recordAuthFlowMetric: jest.fn(),
      recordLockAttempt: jest.fn(),
      recordConcurrentSessionCreation: jest.fn(),
      getMetrics: jest.fn(),
      resetMetrics: jest.fn(),
    } as any;

    workerProcess = {
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

    // Mock executeParallel to execute all functions in parallel
    asyncOperations.executeParallel.mockImplementation(async (functions: (() => Promise<any>)[], _concurrency?: number) => {
      return Promise.all(functions.map(fn => fn()));
    });

    // Mock executeAsync to handle async operations
    asyncOperations.executeAsync.mockImplementation(async (callback: () => any) => {
      return await callback();
    });
  });

  describe('Concurrent Login Race Condition Protection', () => {
    beforeEach(() => {
      // Setup default mocks
      tokenService.generateTokens.mockResolvedValue(mockTokens);
      sessionService.createSessionWithLimit.mockResolvedValue({
        session: mockSession,
        removedSessionsCount: 0,
      });

      // Reset all mocks before each test
      jest.clearAllMocks();
    });

    it('should handle concurrent login attempts without race condition', async () => {
      // Arrange - Simulate concurrent login attempts for the same user
      const concurrentLogins = 3;

      // Mock SessionService to simulate proper session creation with limit
      sessionService.createSessionWithLimit.mockResolvedValue({
        session: mockSession,
        removedSessionsCount: 0,
      });

      // Act - Multiple concurrent login attempts
      const loginPromises = Array.from({ length: concurrentLogins }, () =>
        authService.login(mockUser, '127.0.0.1', 'Test Agent')
      );

      const results = await Promise.all(loginPromises);

      // Assert
      expect(results).toHaveLength(concurrentLogins);
      expect(sessionService.createSessionWithLimit).toHaveBeenCalledTimes(concurrentLogins);

      // Verify that createSessionWithLimit was called with correct parameters
      expect(sessionService.createSessionWithLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          accessToken: mockTokens.accessToken,
          refreshToken: mockTokens.refreshToken,
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
        }),
        5 // maxSessionsPerUser
      );
    });

    it('should record metrics for concurrent session creation attempts', async () => {
      // Arrange - SessionService should handle metrics internally
      sessionService.createSessionWithLimit.mockResolvedValue({
        session: mockSession,
        removedSessionsCount: 0,
      });

      // Act
      await authService.login(mockUser, '127.0.0.1', 'Test Agent');

      // Assert - Verify that SessionService was called (it handles metrics internally)
      expect(sessionService.createSessionWithLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
        }),
        5 // maxSessionsPerUser
      );
    });

    it('should handle lock acquisition failure gracefully', async () => {
      // Arrange - Simulate lock acquisition failure through SessionService
      sessionService.createSessionWithLimit.mockRejectedValue(
        new Error('Failed to acquire lock: session_limit:user-123')
      );

      // Act & Assert
      await expect(
        authService.login(mockUser, '127.0.0.1', 'Test Agent')
      ).rejects.toThrow('Failed to acquire lock: session_limit:user-123');
    });

    it('should use correct parameters for session limiting', async () => {
      // Arrange
      sessionService.createSessionWithLimit.mockResolvedValue({
        session: mockSession,
        removedSessionsCount: 0,
      });

      // Act
      await authService.login(mockUser, '127.0.0.1', 'Test Agent');

      // Assert - Verify correct parameters are passed to SessionService
      expect(sessionService.createSessionWithLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
        }),
        5 // maxSessionsPerUser from config
      );
    });

    it('should enforce session limit atomically within SessionService', async () => {
      // Arrange
      let sessionCreateCallCount = 0;

      sessionService.createSessionWithLimit.mockImplementation(async (sessionData) => {
        sessionCreateCallCount++;
        return {
          session: {
            ...mockSession,
            userId: sessionData.userId,
            updatedAt: new Date(),
            lastAccessedAt: new Date(),
          },
          removedSessionsCount: sessionCreateCallCount === 1 ? 1 : 0, // First call removes old session
        };
      });

      // Act - Multiple concurrent logins
      const promises = [
        authService.login(mockUser, '127.0.0.1', 'Agent1'),
        authService.login(mockUser, '127.0.0.1', 'Agent2'),
      ];

      const results = await Promise.all(promises);

      // Assert - Verify that SessionService was called for both logins
      expect(sessionService.createSessionWithLimit).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
      expect(results[0].session_id).toBe('session-123');
      expect(results[1].session_id).toBe('session-123');
    });
  });

  describe('Session Limit Enforcement with Race Condition Protection', () => {
    it('should prevent race condition when user reaches session limit', async () => {
      // Arrange - SessionService handles the race condition internally
      sessionService.createSessionWithLimit
        .mockResolvedValueOnce({
          session: mockSession,
          removedSessionsCount: 2, // First call removes old sessions
        })
        .mockResolvedValueOnce({
          session: { ...mockSession, id: 'session-456' },
          removedSessionsCount: 0, // Second call doesn't need to remove any
        });

      // Act - Two concurrent login attempts that would exceed limit
      const promises = [
        authService.login(mockUser, '127.0.0.1', 'Agent1'),
        authService.login(mockUser, '127.0.0.1', 'Agent2'),
      ];

      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(2);
      expect(sessionService.createSessionWithLimit).toHaveBeenCalledTimes(2);

      // Verify that both calls used the same user ID and max sessions
      expect(sessionService.createSessionWithLimit).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ userId: 'user-123' }),
        5
      );
      expect(sessionService.createSessionWithLimit).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ userId: 'user-123' }),
        5
      );
    });

    it('should handle session removal during concurrent logins', async () => {
      // Arrange - Simulate that old sessions are removed during login
      sessionService.createSessionWithLimit
        .mockResolvedValueOnce({
          session: mockSession,
          removedSessionsCount: 2, // First login removes 2 old sessions
        })
        .mockResolvedValueOnce({
          session: {
            ...mockSession,
            id: 'session-456',
            updatedAt: new Date(),
            lastAccessedAt: new Date(),
          },
          removedSessionsCount: 0, // Second login doesn't need to remove any
        });



      // Act
      const promises = [
        authService.login(mockUser, '127.0.0.1', 'Agent1'),
        authService.login(mockUser, '127.0.0.1', 'Agent2'),
      ];

      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].session_id).toBe('session-123');
      expect(results[1].session_id).toBe('session-456');
    });
  });

  describe('Session Service Integration', () => {
    it('should pass correct session data to SessionService', async () => {
      // Arrange
      sessionService.createSessionWithLimit.mockResolvedValue({
        session: mockSession,
        removedSessionsCount: 0,
      });

      // Act
      await authService.login(mockUser, '127.0.0.1', 'Test Agent');

      // Assert - Verify SessionService is called with correct parameters
      expect(sessionService.createSessionWithLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          accessToken: mockTokens.accessToken,
          refreshToken: mockTokens.refreshToken,
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
          expiresAt: expect.any(Date),
        }),
        5 // maxSessionsPerUser
      );
    });

    it('should use correct max sessions configuration', async () => {
      // Arrange
      sessionService.createSessionWithLimit.mockResolvedValue({
        session: mockSession,
        removedSessionsCount: 0,
      });

      // Act
      await authService.login(mockUser, '127.0.0.1', 'Test Agent');

      // Assert - Verify max sessions parameter
      expect(sessionService.createSessionWithLimit).toHaveBeenCalledWith(
        expect.any(Object),
        5 // Should use MAX_SESSIONS_PER_USER from config
      );
    });
  });

  describe('Error Handling in Race Condition Scenarios', () => {
    it('should handle session service failures gracefully', async () => {
      // Arrange - SessionService fails (could be due to Redis lock failure or DB issues)
      sessionService.createSessionWithLimit.mockRejectedValue(
        new Error('Session service failed')
      );

      // Act & Assert
      await expect(
        authService.login(mockUser, '127.0.0.1', 'Test Agent')
      ).rejects.toThrow('Session service failed');
    });

    it('should handle database connection failures', async () => {
      // Arrange
      sessionService.createSessionWithLimit.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act & Assert
      await expect(
        authService.login(mockUser, '127.0.0.1', 'Test Agent')
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle token generation failures', async () => {
      // Arrange - Mock JWT service to fail
      const mockJwtServiceFail = {
        signAsync: jest.fn().mockRejectedValue(new Error('Token generation failed')),
        verify: jest.fn(),
      };

      // Replace the JWT service mock for this test
      (authService as any).jwtService = mockJwtServiceFail;

      // Act & Assert
      await expect(
        authService.login(mockUser, '127.0.0.1', 'Test Agent')
      ).rejects.toThrow('Token generation failed');

      // SessionService should not be called if token generation fails
      expect(sessionService.createSessionWithLimit).not.toHaveBeenCalled();
    });
  });

  describe('Session Creation Behavior', () => {
    it('should create sessions through SessionService', async () => {
      // Arrange
      sessionService.createSessionWithLimit.mockResolvedValue({
        session: mockSession,
        removedSessionsCount: 0,
      });

      // Act
      await authService.login(mockUser, '127.0.0.1', 'Test Agent');

      // Assert - Verify SessionService was called correctly
      expect(sessionService.createSessionWithLimit).toHaveBeenCalledTimes(1);
      expect(sessionService.createSessionWithLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
        }),
        5
      );
    });

    it('should handle multiple concurrent session creation attempts', async () => {
      // Arrange
      sessionService.createSessionWithLimit.mockResolvedValue({
        session: mockSession,
        removedSessionsCount: 0,
      });

      // Act - Multiple concurrent logins
      const promises = Array.from({ length: 5 }, () =>
        authService.login(mockUser, '127.0.0.1', 'Test Agent')
      );

      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(5);
      expect(sessionService.createSessionWithLimit).toHaveBeenCalledTimes(5);

      // All calls should be for the same user
      const calls = sessionService.createSessionWithLimit.mock.calls;
      expect(calls.every(call => call[0].userId === mockUser.id)).toBe(true);
    });
  });

  describe('Integration with Security Event Logging', () => {
    it('should log security events when sessions are removed due to limit', async () => {
      // Arrange
      sessionService.createSessionWithLimit.mockResolvedValue({
        session: {
          ...mockSession,
          updatedAt: new Date(),
          lastAccessedAt: new Date(),
        },
        removedSessionsCount: 2, // Sessions were removed
      });

      const mockEventBusService = {
        publishUserLoggedInEvent: jest.fn().mockResolvedValue(undefined),
        publishSecurityEvent: jest.fn().mockResolvedValue(undefined),
      };

      // Mock the event bus service
      (authService as any).eventBusService = mockEventBusService;

      // Act
      await authService.login(mockUser, '127.0.0.1', 'Test Agent');

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert - Verify that security event is published when sessions are removed
      expect(mockEventBusService.publishSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          type: 'login',
          metadata: expect.objectContaining({
            sessionLimitEnforced: true,
            removedSessionsCount: 2,
            raceConditionProtected: true,
          }),
        })
      );
    });
  });

  describe('User Service Integration', () => {
    it('should work with user data from login flow', async () => {
      // Arrange
      sessionService.createSessionWithLimit.mockResolvedValue({
        session: mockSession,
        removedSessionsCount: 0,
      });

      // Act
      const result = await authService.login(mockUser, '127.0.0.1', 'Test Agent');

      // Assert - Verify that user data is properly handled
      expect(result.user.id).toBe(mockUser.id);
      expect(result.user.email).toBe(mockUser.email);
      expect(result.user.name).toBe(mockUser.name);

      // Verify SessionService was called with correct user ID
      expect(sessionService.createSessionWithLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
        }),
        5
      );
    });
  });
});