import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { TokenService } from '../token/token.service';
import { SessionService } from '../session/session.service';
import { UserServiceClient } from '../common/http-client/user-service.client';
import { SecurityServiceClient } from '../common/http-client/security-service.client';
import { NotificationServiceClient } from '../common/http-client/notification-service.client';
import { EventBusService } from '../events/services/event-bus.service';

describe('AuthService - Refresh Token Mechanism', () => {
  let service: AuthService;
  let tokenService: jest.Mocked<TokenService>;
  let sessionService: jest.Mocked<SessionService>;
  let userServiceClient: jest.Mocked<UserServiceClient>;
  let securityServiceClient: jest.Mocked<SecurityServiceClient>;
  let eventBusService: jest.Mocked<EventBusService>;

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

  beforeEach(async () => {
    const mockTokenService = {
      validateRefreshToken: jest.fn(),
      refreshTokenWithRotation: jest.fn(),
      isTokenBlacklisted: jest.fn(),
      blacklistToken: jest.fn(),
    };

    const mockSessionService = {
      createSession: jest.fn(),
      getSession: jest.fn(),
      getSessionByAccessToken: jest.fn(),
      invalidateSession: jest.fn(),
      getUserSessions: jest.fn(),
      enforceSessionLimit: jest.fn(),
    };

    const mockUserServiceClient = {
      findById: jest.fn(),
    };

    const mockSecurityServiceClient = {
      logSecurityEvent: jest.fn(),
      logTokenRefresh: jest.fn(),
    };

    const mockNotificationServiceClient = {
      sendWelcomeNotification: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          'MAX_SESSIONS_PER_USER': 5,
          'JWT_SECRET': 'test-secret',
          'JWT_EXPIRES_IN': '1h',
        };
        return config[key] || defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn(),
            signAsync: jest.fn(),
          },
        },
        {
          provide: TokenService,
          useValue: mockTokenService,
        },
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
        {
          provide: UserServiceClient,
          useValue: mockUserServiceClient,
        },
        {
          provide: SecurityServiceClient,
          useValue: mockSecurityServiceClient,
        },
        {
          provide: NotificationServiceClient,
          useValue: mockNotificationServiceClient,
        },
        {
          provide: EventBusService,
          useValue: {
            publishUserLoggedOutEvent: jest.fn(),
            publishSecurityEvent: jest.fn(),
            publishUserRegisteredEvent: jest.fn(),
            publishUserLoggedInEvent: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    tokenService = module.get(TokenService);
    sessionService = module.get(SessionService);
    userServiceClient = module.get(UserServiceClient);
    securityServiceClient = module.get(SecurityServiceClient);
    eventBusService = module.get(EventBusService);
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
      const result = await service.refreshToken(validRefreshToken);

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
      await expect(service.refreshToken(validRefreshToken)).rejects.toThrow(
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
      await expect(service.refreshToken(validRefreshToken)).rejects.toThrow(
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
      await expect(service.refreshToken(validRefreshToken)).rejects.toThrow(
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
      await expect(service.refreshToken(validRefreshToken)).rejects.toThrow(
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
      await expect(service.refreshToken(validRefreshToken)).rejects.toThrow(
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
      await service.logout(accessToken, userId, refreshToken);

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
      await service.logout(accessToken, userId);

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