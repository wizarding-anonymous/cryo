import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { TokenService } from '../token/token.service';
import { SessionService } from '../session/session.service';
import { UserServiceClient } from '../common/http-client/user-service.client';
import { SecurityServiceClient } from '../common/http-client/security-service.client';
import { NotificationServiceClient } from '../common/http-client/notification-service.client';
import { EventBusService } from '../events/services/event-bus.service';

describe('AuthService - Refresh Token Mechanism', () => {
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
    password: 'hashed-password', // Required by User interface but not used in refresh flow
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTokens = {
    accessToken: 'new-access-token',
    refreshToken: 'new-refresh-token',
    expiresIn: 3600,
  };

  beforeEach(() => {
    // Создаем моки напрямую
    jwtService = {
      signAsync: jest.fn(),
      verify: jest.fn(),
    } as any;

    tokenService = {
      validateRefreshToken: jest.fn(),
      refreshTokenWithRotation: jest.fn(),
      isTokenBlacklisted: jest.fn(),
      blacklistToken: jest.fn(),
      hashToken: jest.fn(),
    } as any;

    sessionService = {
      createSession: jest.fn(),
      createSessionWithLimit: jest.fn(),
      getSession: jest.fn(),
      getSessionByAccessToken: jest.fn(),
      getSessionByRefreshToken: jest.fn(),
      invalidateSession: jest.fn(),
      getUserSessions: jest.fn(),
      enforceSessionLimit: jest.fn(),
      updateLastAccessed: jest.fn(),
    } as any;

    userServiceClient = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      createUser: jest.fn(),
      updateLastLogin: jest.fn(),
    } as any;

    securityServiceClient = {
      logSecurityEvent: jest.fn().mockResolvedValue(undefined),
      logTokenRefresh: jest.fn().mockResolvedValue(undefined),
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
        if (key === 'JWT_SECRET') return 'test-secret';
        if (key === 'JWT_EXPIRES_IN') return '1h';
        return defaultValue;
      }),
    } as any;

    authSagaService = {
      executeRegistrationSaga: jest.fn(),
      executeLoginSaga: jest.fn(),
      waitForSagaCompletion: jest.fn(),
    } as any;

    sagaService = {
      createSaga: jest.fn(),
      executeSaga: jest.fn(),
      getSagaStatus: jest.fn(),
    } as any;

    asyncOperations = {
      executeAsync: jest.fn(),
      executeCriticalPath: jest.fn(),
      getOperationStatus: jest.fn(),
    } as any;

    metricsService = {
      recordMetric: jest.fn(),
      recordAuthFlowMetric: jest.fn(),
      getMetrics: jest.fn(),
    } as any;

    workerProcess = {
      executeInWorker: jest.fn(),
      executeBatchInWorkers: jest.fn(),
      getWorkerMetrics: jest.fn(),
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
  });

  describe('refreshToken', () => {
    const validRefreshToken = 'valid-refresh-token';

    it('should successfully refresh token with rotation', async () => {
      // Arrange
      const mockPayload = { sub: mockUser.id, email: mockUser.email };
      tokenService.validateRefreshToken.mockResolvedValue({
        valid: true,
        payload: mockPayload,
      });
      userServiceClient.findById.mockResolvedValue(mockUser);
      tokenService.refreshTokenWithRotation.mockResolvedValue(mockTokens);

      // Act
      const result = await authService.refreshToken(validRefreshToken);

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert
      expect(result).toEqual({
        access_token: mockTokens.accessToken,
        refresh_token: mockTokens.refreshToken,
        expires_in: mockTokens.expiresIn,
      });

      expect(tokenService.validateRefreshToken).toHaveBeenCalledWith(validRefreshToken);
      expect(userServiceClient.findById).toHaveBeenCalledWith(mockUser.id);
      expect(tokenService.refreshTokenWithRotation).toHaveBeenCalledWith(
        validRefreshToken,
        mockUser.id
      );
      expect(securityServiceClient.logTokenRefresh).toHaveBeenCalledWith(
        mockUser.id,
        '::1',
        {
          tokenRotated: true,
          oldTokenBlacklisted: true,
        }
      );
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      // Arrange
      tokenService.validateRefreshToken.mockResolvedValue({
        valid: false,
        reason: 'Token expired',
      });

      // Act & Assert
      await expect(authService.refreshToken(validRefreshToken)).rejects.toThrow(
        new UnauthorizedException('Token expired')
      );

      expect(tokenService.validateRefreshToken).toHaveBeenCalledWith(validRefreshToken);
      expect(userServiceClient.findById).not.toHaveBeenCalled();
      expect(tokenService.refreshTokenWithRotation).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for blacklisted refresh token', async () => {
      // Arrange
      tokenService.validateRefreshToken.mockResolvedValue({
        valid: false,
        reason: 'Refresh token is blacklisted',
      });

      // Act & Assert
      await expect(authService.refreshToken(validRefreshToken)).rejects.toThrow(
        new UnauthorizedException('Refresh token is blacklisted')
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      // Arrange
      const mockPayload = { sub: 'non-existent-user', email: 'test@example.com' };
      tokenService.validateRefreshToken.mockResolvedValue({
        valid: true,
        payload: mockPayload,
      });
      userServiceClient.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.refreshToken(validRefreshToken)).rejects.toThrow(
        new UnauthorizedException('User not found or deleted')
      );

      expect(userServiceClient.findById).toHaveBeenCalledWith('non-existent-user');
      expect(tokenService.refreshTokenWithRotation).not.toHaveBeenCalled();
    });

    it('should handle TokenService errors gracefully', async () => {
      // Arrange
      const mockPayload = { sub: mockUser.id, email: mockUser.email };
      tokenService.validateRefreshToken.mockResolvedValue({
        valid: true,
        payload: mockPayload,
      });
      userServiceClient.findById.mockResolvedValue(mockUser);
      tokenService.refreshTokenWithRotation.mockRejectedValue(
        new Error('Invalid refresh token: Token user ID mismatch')
      );

      // Act & Assert
      await expect(authService.refreshToken(validRefreshToken)).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token: Token user ID mismatch')
      );
    });

    it('should handle unexpected errors', async () => {
      // Arrange
      const mockPayload = { sub: mockUser.id, email: mockUser.email };
      tokenService.validateRefreshToken.mockResolvedValue({
        valid: true,
        payload: mockPayload,
      });
      userServiceClient.findById.mockResolvedValue(mockUser);
      tokenService.refreshTokenWithRotation.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act & Assert
      await expect(authService.refreshToken(validRefreshToken)).rejects.toThrow(
        new UnauthorizedException('Unable to refresh token')
      );
    });
  });

  describe('logout with refresh token', () => {
    const accessToken = 'access-token';
    const refreshToken = 'refresh-token';
    const userId = 'user-123';

    it('should blacklist both access and refresh tokens on logout', async () => {
      // Arrange
      const mockSession = {
        id: 'session-123',
        userId,
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        isActive: true,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        lastAccessedAt: new Date(),
      };
      sessionService.getSessionByAccessToken.mockResolvedValue(mockSession);

      // Act
      await authService.logout(accessToken, userId, refreshToken);

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert
      expect(sessionService.getSessionByAccessToken).toHaveBeenCalledWith(accessToken);
      expect(sessionService.invalidateSession).toHaveBeenCalledWith(mockSession.id);
      expect(tokenService.blacklistToken).toHaveBeenCalledTimes(2);
      expect(tokenService.blacklistToken).toHaveBeenCalledWith(
        accessToken,
        userId,
        'logout'
      );
      expect(tokenService.blacklistToken).toHaveBeenCalledWith(
        refreshToken,
        userId,
        'logout'
      );
      expect(eventBusService.publishUserLoggedOutEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          sessionId: 'session-123',
          ipAddress: '::1',
          reason: 'manual',
          timestamp: expect.any(Date),
        })
      );
    });

    it('should blacklist only access token when refresh token not provided', async () => {
      // Arrange
      const mockSession = {
        id: 'session-123',
        userId,
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        isActive: true,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        lastAccessedAt: new Date(),
      };
      sessionService.getSessionByAccessToken.mockResolvedValue(mockSession);

      // Act
      await authService.logout(accessToken, userId);

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert
      expect(sessionService.getSessionByAccessToken).toHaveBeenCalledWith(accessToken);
      expect(sessionService.invalidateSession).toHaveBeenCalledWith(mockSession.id);
      expect(tokenService.blacklistToken).toHaveBeenCalledTimes(1);
      expect(tokenService.blacklistToken).toHaveBeenCalledWith(
        accessToken,
        userId,
        'logout'
      );
      expect(eventBusService.publishUserLoggedOutEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          sessionId: 'session-123',
          ipAddress: '::1',
          reason: 'manual',
          timestamp: expect.any(Date),
        })
      );
    });
  });
});