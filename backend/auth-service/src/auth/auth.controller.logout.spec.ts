import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LogoutDto } from './dto/logout.dto';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

describe('AuthController - Logout', () => {
    let controller: AuthController;
    let authService: jest.Mocked<AuthService>;

    const mockAuthService = {
        logout: jest.fn(),
    };

    beforeEach(async () => {
        authService = mockAuthService as any;
        controller = new AuthController(authService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('logout', () => {
        const mockAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token';
        const mockUserId = 'user-123';
        const mockIpAddress = '192.168.1.1';

        const mockRequest: Partial<AuthenticatedRequest> = {
            user: { userId: mockUserId, email: 'test@example.com' },
            ip: mockIpAddress,
            headers: {
                authorization: `Bearer ${mockAccessToken}`,
            },
        };

        it('should logout user with access token only', async () => {
            // Arrange
            mockAuthService.logout.mockResolvedValue(undefined);

            // Act
            await controller.logout(
                `Bearer ${mockAccessToken}`,
                mockRequest as AuthenticatedRequest,
            );

            // Assert
            expect(mockAuthService.logout).toHaveBeenCalledWith(
                mockAccessToken,
                mockUserId,
                undefined, // no refresh token
                mockIpAddress,
            );
        });

        it('should logout user with both access and refresh tokens', async () => {
            // Arrange
            const refreshToken = 'refresh-token-123';
            const logoutDto: LogoutDto = { refreshToken };
            mockAuthService.logout.mockResolvedValue(undefined);

            // Act
            await controller.logout(
                `Bearer ${mockAccessToken}`,
                mockRequest as AuthenticatedRequest,
                logoutDto,
            );

            // Assert
            expect(mockAuthService.logout).toHaveBeenCalledWith(
                mockAccessToken,
                mockUserId,
                refreshToken,
                mockIpAddress,
            );
        });

        it('should handle logout without authorization header', async () => {
            // Arrange
            mockAuthService.logout.mockResolvedValue(undefined);

            // Act
            await controller.logout(
                undefined,
                mockRequest as AuthenticatedRequest,
            );

            // Assert
            expect(mockAuthService.logout).toHaveBeenCalledWith(
                undefined,
                mockUserId,
                undefined,
                mockIpAddress,
            );
        });

        it('should extract IP address from different sources', async () => {
            // Arrange
            const requestWithForwardedFor: Partial<AuthenticatedRequest> = {
                user: { userId: mockUserId, email: 'test@example.com' },
                headers: {
                    authorization: `Bearer ${mockAccessToken}`,
                    'x-forwarded-for': '10.0.0.1, 192.168.1.1',
                },
                // Don't set connection.remoteAddress so it falls back to x-forwarded-for
            };
            mockAuthService.logout.mockResolvedValue(undefined);

            // Act
            await controller.logout(
                `Bearer ${mockAccessToken}`,
                requestWithForwardedFor as AuthenticatedRequest,
            );

            // Assert
            expect(mockAuthService.logout).toHaveBeenCalledWith(
                mockAccessToken,
                mockUserId,
                undefined,
                '10.0.0.1', // Should use first IP from x-forwarded-for
            );
        });

        it('should use fallback IP when no IP is available', async () => {
            // Arrange
            const requestWithoutIp: Partial<AuthenticatedRequest> = {
                user: { userId: mockUserId, email: 'test@example.com' },
                headers: {
                    authorization: `Bearer ${mockAccessToken}`,
                },
            };
            mockAuthService.logout.mockResolvedValue(undefined);

            // Act
            await controller.logout(
                `Bearer ${mockAccessToken}`,
                requestWithoutIp as AuthenticatedRequest,
            );

            // Assert
            expect(mockAuthService.logout).toHaveBeenCalledWith(
                mockAccessToken,
                mockUserId,
                undefined,
                '::1', // Fallback IP
            );
        });

        it('should propagate auth service errors', async () => {
            // Arrange
            const error = new Error('Token blacklisting failed');
            mockAuthService.logout.mockRejectedValue(error);

            // Act & Assert
            await expect(
                controller.logout(
                    `Bearer ${mockAccessToken}`,
                    mockRequest as AuthenticatedRequest,
                ),
            ).rejects.toThrow('Token blacklisting failed');

            expect(mockAuthService.logout).toHaveBeenCalledWith(
                mockAccessToken,
                mockUserId,
                undefined,
                mockIpAddress,
            );
        });

        it('should handle malformed authorization header', async () => {
            // Arrange
            const malformedHeader = 'InvalidHeader';
            mockAuthService.logout.mockResolvedValue(undefined);

            // Act
            await controller.logout(
                malformedHeader,
                mockRequest as AuthenticatedRequest,
            );

            // Assert
            expect(mockAuthService.logout).toHaveBeenCalledWith(
                undefined, // Should be undefined when header is malformed
                mockUserId,
                undefined,
                mockIpAddress,
            );
        });
    });
});