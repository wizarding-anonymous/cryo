import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { TokenService } from '../token/token.service';
import { SessionService } from '../session/session.service';
import { SessionRepository } from '../repositories/session.repository';
import { UserServiceClient } from '../common/http-client/user-service.client';
import { SecurityServiceClient } from '../common/http-client/security-service.client';
import { NotificationServiceClient } from '../common/http-client/notification-service.client';
import { RedisService } from '../common/redis/redis.service';
import { AuthDatabaseService } from '../database/auth-database.service';
import { ConfigService } from '@nestjs/config';
import { EventBusService } from '../events/services/event-bus.service';

describe('Refresh Token Integration', () => {
    let authService: AuthService;
    let tokenService: TokenService;
    let userServiceClient: jest.Mocked<UserServiceClient>;
    let securityServiceClient: jest.Mocked<SecurityServiceClient>;
    let eventBusService: jest.Mocked<EventBusService>;
    const mockSessionService = {
        createSession: jest.fn(),
        getSession: jest.fn(),
        getSessionByAccessToken: jest.fn(),
        invalidateSession: jest.fn(),
        getUserSessions: jest.fn(),
        enforceSessionLimit: jest.fn(),
    };

    const mockUser = {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        const mockRedisService = {
            blacklistToken: jest.fn().mockResolvedValue(undefined),
            isTokenBlacklisted: jest.fn().mockResolvedValue(false),
            delete: jest.fn().mockResolvedValue(undefined),
            set: jest.fn().mockResolvedValue(undefined),
            get: jest.fn().mockResolvedValue(null),
        };

        const mockAuthDatabaseService = {
            blacklistToken: jest.fn().mockResolvedValue(undefined),
            isTokenBlacklisted: jest.fn().mockResolvedValue(false),
            blacklistAllUserTokens: jest.fn().mockResolvedValue(undefined),
            cleanupExpiredTokens: jest.fn().mockResolvedValue(0),
            getUserBlacklistedTokens: jest.fn().mockResolvedValue([]),
        };

        const mockTokenService = {
            generateTokens: jest.fn(),
            blacklistToken: jest.fn().mockResolvedValue(undefined),
            isTokenBlacklisted: jest.fn().mockResolvedValue(false),
            validateToken: jest.fn(),
            validateRefreshToken: jest.fn(),
            refreshTokenWithRotation: jest.fn(),
            blacklistAllUserTokens: jest.fn(),
            validateTokenWithUserCheck: jest.fn(),
            cleanupExpiredTokens: jest.fn(),
            getUserBlacklistedTokens: jest.fn(),
            decodeToken: jest.fn(),
            areAllUserTokensInvalidated: jest.fn().mockResolvedValue(false),
        };

        const mockUserServiceClient = {
            findById: jest.fn().mockResolvedValue(mockUser),
            findByEmail: jest.fn(),
            createUser: jest.fn(),
            updateLastLogin: jest.fn(),
        };

        const mockSecurityServiceClient = {
            logSecurityEvent: jest.fn().mockResolvedValue(undefined),
            checkSuspiciousActivity: jest.fn().mockResolvedValue(false),
            logTokenRefresh: jest.fn().mockResolvedValue(undefined),
        };

        const mockNotificationServiceClient = {
            sendWelcomeNotification: jest.fn(),
        };

        // Для интеграционного теста используем реальный SessionService
        // но мокаем его зависимости
        const mockSessionRepository = {
            create: jest.fn(),
            findById: jest.fn(),
            findByAccessToken: jest.fn(),
            findByRefreshToken: jest.fn(),
            findByUserId: jest.fn(),
            updateLastAccessed: jest.fn(),
            deactivateSession: jest.fn(),
            deactivateAllUserSessions: jest.fn(),
            cleanupExpiredSessions: jest.fn(),
            getSessionStats: jest.fn(),
            countActiveSessionsByUserId: jest.fn(),
            findSessionsByIpAddress: jest.fn(),
            findStaleSessionsOlderThan: jest.fn(),
            updateSessionMetadata: jest.fn(),
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
                    provide: TokenService,
                    useValue: mockTokenService,
                },
                {
                    provide: JwtService,
                    useValue: {
                        signAsync: jest.fn(),
                        verify: jest.fn(),
                        decode: jest.fn(),
                    },
                },
                {
                    provide: RedisService,
                    useValue: mockRedisService,
                },
                {
                    provide: AuthDatabaseService,
                    useValue: mockAuthDatabaseService,
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
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
                {
                    provide: SessionService,
                    useValue: mockSessionService,
                },
                {
                    provide: SessionRepository,
                    useValue: mockSessionRepository,
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
            ],
        }).compile();

        authService = module.get<AuthService>(AuthService);
        tokenService = module.get<TokenService>(TokenService);
        userServiceClient = module.get(UserServiceClient);
        securityServiceClient = module.get(SecurityServiceClient);
        eventBusService = module.get(EventBusService);
    });

    describe('Complete Refresh Token Flow', () => {
        it('should complete full refresh token rotation cycle', async () => {
            // Arrange
            const refreshToken = 'valid-refresh-token';
            const newAccessToken = 'new-access-token';
            const newRefreshToken = 'new-refresh-token';

            const mockPayload = {
                sub: mockUser.id,
                email: mockUser.email,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 // 7 days
            };

            const mockTokens = {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
                expiresIn: 3600,
            };

            // Mock TokenService methods
            (tokenService.validateRefreshToken as jest.Mock).mockResolvedValue({
                valid: true,
                payload: mockPayload,
            });

            (tokenService.refreshTokenWithRotation as jest.Mock).mockResolvedValue(mockTokens);

            // Act
            const result = await authService.refreshToken(refreshToken);

            // Assert
            expect(result).toEqual({
                access_token: newAccessToken,
                refresh_token: newRefreshToken,
                expires_in: 3600,
            });

            // Verify TokenService methods were called correctly
            expect(tokenService.validateRefreshToken).toHaveBeenCalledWith(refreshToken);
            expect(tokenService.refreshTokenWithRotation).toHaveBeenCalledWith(
                refreshToken,
                mockUser.id
            );

            // Verify security event was logged
            expect(securityServiceClient.logTokenRefresh).toHaveBeenCalledWith(
                mockUser.id,
                '::1',
                {
                    tokenRotated: true,
                    oldTokenBlacklisted: true,
                }
            );

            // Verify user existence was checked
            expect(userServiceClient.findById).toHaveBeenCalledWith(mockUser.id);
        });

        it('should prevent refresh token reuse after rotation', async () => {
            // Arrange
            const refreshToken = 'used-refresh-token';
            const mockPayload = {
                sub: mockUser.id,
                email: mockUser.email,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
            };

            const mockTokens = {
                accessToken: 'new-access-token',
                refreshToken: 'new-refresh-token',
                expiresIn: 3600,
            };

            // First call succeeds
            (tokenService.validateRefreshToken as jest.Mock).mockResolvedValueOnce({
                valid: true,
                payload: mockPayload,
            });
            (tokenService.refreshTokenWithRotation as jest.Mock).mockResolvedValueOnce(mockTokens);

            // First refresh succeeds
            await authService.refreshToken(refreshToken);

            // Now simulate the token being blacklisted
            (tokenService.validateRefreshToken as jest.Mock).mockResolvedValueOnce({
                valid: false,
                reason: 'Refresh token is blacklisted',
            });

            // Act & Assert - Second attempt should fail
            await expect(authService.refreshToken(refreshToken)).rejects.toThrow(
                new UnauthorizedException('Refresh token is blacklisted')
            );
        });

        it('should handle expired refresh tokens', async () => {
            // Arrange
            const expiredRefreshToken = 'expired-refresh-token';

            (tokenService.validateRefreshToken as jest.Mock).mockResolvedValue({
                valid: false,
                reason: 'Refresh token expired',
            });

            // Act & Assert
            await expect(authService.refreshToken(expiredRefreshToken)).rejects.toThrow(
                new UnauthorizedException('Refresh token expired')
            );

            // Verify no new tokens were generated
            expect(tokenService.refreshTokenWithRotation).not.toHaveBeenCalled();
            expect(securityServiceClient.logSecurityEvent).not.toHaveBeenCalled();
        });

        it('should handle deleted users during refresh', async () => {
            // Arrange
            const refreshToken = 'valid-refresh-token';
            const mockPayload = {
                sub: 'deleted-user-id',
                email: 'deleted@example.com',
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
            };

            (tokenService.validateRefreshToken as jest.Mock).mockResolvedValue({
                valid: true,
                payload: mockPayload,
            });
            userServiceClient.findById.mockResolvedValue(null); // User not found

            // Act & Assert
            await expect(authService.refreshToken(refreshToken)).rejects.toThrow(
                new UnauthorizedException('User not found or deleted')
            );

            // Verify no new tokens were generated
            expect(tokenService.refreshTokenWithRotation).not.toHaveBeenCalled();
        });
    });

    describe('Logout with Refresh Token', () => {
        it('should blacklist both access and refresh tokens on logout', async () => {
            // Arrange
            const accessToken = 'access-token';
            const refreshToken = 'refresh-token';
            const userId = mockUser.id;

            // Mock session service to return a session
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
            mockSessionService.getSessionByAccessToken.mockResolvedValue(mockSession);

            // Act
            await authService.logout(accessToken, userId, refreshToken);

            // Assert
            expect(mockSessionService.getSessionByAccessToken).toHaveBeenCalledWith(accessToken);
            expect(mockSessionService.invalidateSession).toHaveBeenCalledWith(mockSession.id);

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
    });
});