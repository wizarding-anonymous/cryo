import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

describe('AuthController - Login Endpoint', () => {
    let controller: AuthController;
    let authService: jest.Mocked<AuthService>;

    const mockUser = {
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockAuthResponse = {
        user: mockUser,
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        session_id: 'session-123',
        expires_in: 3600,
    };

    beforeEach(() => {
        // Create mock AuthService
        authService = {
            validateUser: jest.fn(),
            login: jest.fn(),
            logFailedLoginAttempt: jest.fn(),
        } as any;

        // Create controller instance directly
        controller = new AuthController(authService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('login', () => {
        const loginDto: LoginDto = {
            email: 'john@example.com',
            password: 'StrongPass123!',
        };

        const mockRequest = {
            ip: '127.0.0.1',
            headers: {
                'user-agent': 'Test Agent',
            },
        };

        it('should successfully authenticate user with valid credentials', async () => {
            // Arrange
            authService.validateUser.mockResolvedValue(mockUser);
            authService.login.mockResolvedValue(mockAuthResponse);

            // Act
            const result = await controller.login(loginDto, mockRequest);

            // Assert
            expect(result).toEqual(mockAuthResponse);
            expect(authService.validateUser).toHaveBeenCalledWith(
                loginDto.email,
                loginDto.password
            );
            expect(authService.login).toHaveBeenCalledWith(
                mockUser,
                '127.0.0.1',
                'Test Agent'
            );
        });

        it('should throw UnauthorizedException for invalid credentials', async () => {
            // Arrange
            authService.validateUser.mockResolvedValue(null);
            authService.logFailedLoginAttempt.mockResolvedValue(undefined);

            // Act & Assert
            await expect(controller.login(loginDto, mockRequest))
                .rejects
                .toThrow(UnauthorizedException);
            
            expect(authService.validateUser).toHaveBeenCalledWith(
                loginDto.email,
                loginDto.password
            );
            expect(authService.logFailedLoginAttempt).toHaveBeenCalledWith(
                loginDto.email,
                '127.0.0.1',
                'Invalid credentials',
                { userAgent: 'Test Agent' }
            );
            expect(authService.login).not.toHaveBeenCalled();
        });

        it('should extract IP address from request correctly', async () => {
            // Arrange
            authService.validateUser.mockResolvedValue(mockUser);
            authService.login.mockResolvedValue(mockAuthResponse);
            const requestWithDifferentIp = {
                connection: { remoteAddress: '192.168.1.1' },
                headers: { 'user-agent': 'Test Agent' },
            };

            // Act
            await controller.login(loginDto, requestWithDifferentIp);

            // Assert
            expect(authService.login).toHaveBeenCalledWith(
                mockUser,
                '192.168.1.1',
                'Test Agent'
            );
        });

        it('should extract IP from x-forwarded-for header', async () => {
            // Arrange
            authService.validateUser.mockResolvedValue(mockUser);
            authService.login.mockResolvedValue(mockAuthResponse);
            const requestWithForwardedFor = {
                headers: {
                    'x-forwarded-for': '203.0.113.1, 192.168.1.1',
                    'user-agent': 'Test Agent',
                },
            };

            // Act
            await controller.login(loginDto, requestWithForwardedFor);

            // Assert
            expect(authService.login).toHaveBeenCalledWith(
                mockUser,
                '203.0.113.1', // First IP from x-forwarded-for
                'Test Agent'
            );
        });

        it('should use default IP when no IP is available', async () => {
            // Arrange
            authService.validateUser.mockResolvedValue(mockUser);
            authService.login.mockResolvedValue(mockAuthResponse);
            const requestWithoutIp = {
                headers: { 'user-agent': 'Test Agent' },
            };

            // Act
            await controller.login(loginDto, requestWithoutIp);

            // Assert
            expect(authService.login).toHaveBeenCalledWith(
                mockUser,
                '::1', // Default IP
                'Test Agent'
            );
        });

        it('should use default user agent when not provided', async () => {
            // Arrange
            authService.validateUser.mockResolvedValue(mockUser);
            authService.login.mockResolvedValue(mockAuthResponse);
            const requestWithoutUserAgent = {
                ip: '127.0.0.1',
                headers: {},
            };

            // Act
            await controller.login(loginDto, requestWithoutUserAgent);

            // Assert
            expect(authService.login).toHaveBeenCalledWith(
                mockUser,
                '127.0.0.1',
                'Unknown' // Default user agent
            );
        });

        it('should propagate UnauthorizedException from validateUser', async () => {
            // Arrange
            const authError = new UnauthorizedException('Account locked');
            authService.validateUser.mockRejectedValue(authError);

            // Act & Assert
            await expect(controller.login(loginDto, mockRequest))
                .rejects
                .toThrow(UnauthorizedException);

            expect(authService.validateUser).toHaveBeenCalledWith(
                loginDto.email,
                loginDto.password
            );
            expect(authService.login).not.toHaveBeenCalled();
        });

        it('should propagate other errors from AuthService', async () => {
            // Arrange
            authService.validateUser.mockResolvedValue(mockUser);
            const serviceError = new Error('Service unavailable');
            authService.login.mockRejectedValue(serviceError);

            // Act & Assert
            await expect(controller.login(loginDto, mockRequest))
                .rejects
                .toThrow('Service unavailable');

            expect(authService.validateUser).toHaveBeenCalledWith(
                loginDto.email,
                loginDto.password
            );
            expect(authService.login).toHaveBeenCalledWith(
                mockUser,
                '127.0.0.1',
                'Test Agent'
            );
        });

        it('should handle request with all IP extraction methods', async () => {
            // Arrange
            authService.validateUser.mockResolvedValue(mockUser);
            authService.login.mockResolvedValue(mockAuthResponse);
            const complexRequest = {
                ip: '10.0.0.1',
                connection: { remoteAddress: '192.168.1.1' },
                socket: { remoteAddress: '172.16.0.1' },
                headers: {
                    'x-forwarded-for': '203.0.113.1, 192.168.1.1',
                    'user-agent': 'Mozilla/5.0 Test Agent',
                },
            };

            // Act
            await controller.login(loginDto, complexRequest);

            // Assert - Should prefer request.ip first
            expect(authService.login).toHaveBeenCalledWith(
                mockUser,
                '10.0.0.1',
                'Mozilla/5.0 Test Agent'
            );
        });

        it('should return correct error message for invalid credentials', async () => {
            // Arrange
            authService.validateUser.mockResolvedValue(null);
            authService.logFailedLoginAttempt.mockResolvedValue(undefined);

            // Act & Assert
            try {
                await controller.login(loginDto, mockRequest);
                fail('Expected UnauthorizedException to be thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(UnauthorizedException);
                expect(error.message).toBe('Неверный email или пароль');
                expect(authService.logFailedLoginAttempt).toHaveBeenCalledWith(
                    loginDto.email,
                    '127.0.0.1',
                    'Invalid credentials',
                    { userAgent: 'Test Agent' }
                );
            }
        });
    });

    describe('IP and User Agent extraction for login', () => {
        const testLoginDto: LoginDto = {
            email: 'test@example.com',
            password: 'TestPass123!',
        };

        beforeEach(() => {
            authService.validateUser.mockResolvedValue(mockUser);
            authService.login.mockResolvedValue(mockAuthResponse);
        });

        it('should extract client IP correctly with priority order', async () => {
            const testCases = [
                {
                    request: { ip: '10.0.0.1', headers: { 'user-agent': 'Test' } },
                    expected: '10.0.0.1',
                },
                {
                    request: { connection: { remoteAddress: '192.168.1.1' }, headers: { 'user-agent': 'Test' } },
                    expected: '192.168.1.1',
                },
                {
                    request: { socket: { remoteAddress: '172.16.0.1' }, headers: { 'user-agent': 'Test' } },
                    expected: '172.16.0.1',
                },
                {
                    request: { headers: { 'x-forwarded-for': '203.0.113.1, 192.168.1.1', 'user-agent': 'Test' } },
                    expected: '203.0.113.1',
                },
                {
                    request: { headers: { 'user-agent': 'Test' } },
                    expected: '::1',
                }
            ];

            for (const { request, expected } of testCases) {
                await controller.login(testLoginDto, request);

                expect(authService.login).toHaveBeenCalledWith(
                    mockUser,
                    expected,
                    expect.any(String)
                );

                jest.clearAllMocks();
                authService.validateUser.mockResolvedValue(mockUser);
                authService.login.mockResolvedValue(mockAuthResponse);
            }
        });

        it('should extract user agent correctly', async () => {
            const testCases = [
                {
                    request: { ip: '127.0.0.1', headers: { 'user-agent': 'Mozilla/5.0 Chrome' } },
                    expected: 'Mozilla/5.0 Chrome',
                },
                {
                    request: { ip: '127.0.0.1', headers: {} },
                    expected: 'Unknown',
                }
            ];

            for (const { request, expected } of testCases) {
                await controller.login(testLoginDto, request);

                expect(authService.login).toHaveBeenCalledWith(
                    mockUser,
                    expect.any(String),
                    expected
                );

                jest.clearAllMocks();
                authService.validateUser.mockResolvedValue(mockUser);
                authService.login.mockResolvedValue(mockAuthResponse);
            }
        });
    });
});