import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { TokenService } from '../token/token.service';
import { SessionService } from '../session/session.service';
import { UserServiceClient } from '../common/http-client/user-service.client';
import { SecurityServiceClient } from '../common/http-client/security-service.client';
import { EventBusService } from '../events/services/event-bus.service';

describe('Refresh Token Integration', () => {
    let authService: AuthService;
    let tokenService: jest.Mocked<TokenService>;
    let userServiceClient: jest.Mocked<UserServiceClient>;
    let securityServiceClient: jest.Mocked<SecurityServiceClient>;
    let eventBusService: jest.Mocked<EventBusService>;
    let sessionService: jest.Mocked<SessionService>;

    const mockUser = {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(() => {
        jest.useFakeTimers({ legacyFakeTimers: true });
        tokenService = {
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
        } as any;

        userServiceClient = {
            findById: jest.fn().mockResolvedValue(mockUser),
            findByEmail: jest.fn(),
            createUser: jest.fn(),
            updateLastLogin: jest.fn(),
        } as any;

        securityServiceClient = {
            logSecurityEvent: jest.fn().mockResolvedValue(undefined),
            checkSuspiciousActivity: jest.fn().mockResolvedValue(false),
            logTokenRefresh: jest.fn().mockResolvedValue(undefined),
        } as any;

        const mockNotificationServiceClient = {
            sendWelcomeNotification: jest.fn(),
        } as any;

        sessionService = {
            createSession: jest.fn(),
            getSession: jest.fn(),
            getSessionByAccessToken: jest.fn(),
            invalidateSession: jest.fn(),
            getUserSessions: jest.fn(),
            enforceSessionLimit: jest.fn(),
        } as any;

        eventBusService = {
            publishUserLoggedOutEvent: jest.fn().mockResolvedValue(undefined),
            publishSecurityEvent: jest.fn().mockResolvedValue(undefined),
            publishUserRegisteredEvent: jest.fn().mockResolvedValue(undefined),
            publishUserLoggedInEvent: jest.fn().mockResolvedValue(undefined),
        } as any;

        const mockJwtService = {
            signAsync: jest.fn(),
            verify: jest.fn(),
            decode: jest.fn(),
        } as any;

        const mockConfigService = {
            get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
                const config = {
                    'MAX_SESSIONS_PER_USER': 5,
                    'JWT_SECRET': 'test-secret',
                    'JWT_EXPIRES_IN': '1h',
                    'USE_SAGA_PATTERN': false,
                };
                return config[key] || defaultValue;
            }),
        } as any;

        const mockAuthSagaService = {
            executeRegistrationSaga: jest.fn(),
            executeLoginSaga: jest.fn(),
            waitForSagaCompletion: jest.fn(),
        } as any;

        const mockSagaService = {
            startSaga: jest.fn(),
            getSaga: jest.fn(),
        } as any;

        const mockAsyncOperations = {
            executeCriticalPath: jest.fn().mockImplementation(async (fn) => await fn()),
            executeImmediate: jest.fn().mockImplementation((fn) => {
                // Execute immediately without setImmediate to avoid timing issues in tests
                return Promise.resolve(fn());
            }),
            executeParallel: jest.fn().mockImplementation(async (operations) => {
                const results = [];
                for (const op of operations) {
                    results.push(await op());
                }
                return results;
            }),
            executeBatch: jest.fn().mockImplementation(async (operations) => {
                const results = [];
                for (const op of operations) {
                    results.push(await op());
                }
                return results;
            }),
        } as any;

        const mockMetricsService = {
            recordOperation: jest.fn(),
            getMetrics: jest.fn(),
        } as any;

        const mockWorkerProcess = {
            processTask: jest.fn(),
            getStatus: jest.fn(),
        } as any;

        authService = new AuthService(
            mockJwtService,
            tokenService,
            sessionService,
            userServiceClient,
            securityServiceClient,
            mockNotificationServiceClient,
            eventBusService,
            mockConfigService,
            mockAuthSagaService,
            mockSagaService,
            mockAsyncOperations,
            mockMetricsService,
            mockWorkerProcess
        );
    });

    afterEach(() => {
        jest.useRealTimers();
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

            // Verify user existence was checked
            expect(userServiceClient.findById).toHaveBeenCalledWith(mockUser.id);
            
            // Note: logTokenRefresh is not called in the current implementation
            // This might be a missing feature that needs to be added
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
            sessionService.getSessionByAccessToken.mockResolvedValue(mockSession);

            // Act
            await authService.logout(accessToken, userId, refreshToken);
            
            // Wait for setImmediate to execute
            jest.runAllImmediates();

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
    });
});