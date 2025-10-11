import { ConflictException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';

describe('AuthController - Register Endpoint', () => {
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
            register: jest.fn(),
        } as any;

        // Create controller instance directly
        controller = new AuthController(authService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('register', () => {
        const registerDto: RegisterDto = {
            name: 'John Doe',
            email: 'john@example.com',
            password: 'StrongPass123!',
        };

        const mockRequest = {
            ip: '127.0.0.1',
            headers: {
                'user-agent': 'Test Agent',
            },
        };

        it('should successfully register a new user', async () => {
            // Arrange
            authService.register.mockResolvedValue(mockAuthResponse);

            // Act
            const result = await controller.register(registerDto, mockRequest);

            // Assert
            expect(result).toEqual(mockAuthResponse);
            expect(authService.register).toHaveBeenCalledWith(
                registerDto,
                '127.0.0.1',
                'Test Agent'
            );
        });

        it('should extract IP address from request correctly', async () => {
            // Arrange
            authService.register.mockResolvedValue(mockAuthResponse);
            const requestWithDifferentIp = {
                connection: { remoteAddress: '192.168.1.1' },
                headers: { 'user-agent': 'Test Agent' },
            };

            // Act
            await controller.register(registerDto, requestWithDifferentIp);

            // Assert
            expect(authService.register).toHaveBeenCalledWith(
                registerDto,
                '192.168.1.1',
                'Test Agent'
            );
        });

        it('should extract IP from x-forwarded-for header', async () => {
            // Arrange
            authService.register.mockResolvedValue(mockAuthResponse);
            const requestWithForwardedFor = {
                headers: {
                    'x-forwarded-for': '203.0.113.1, 192.168.1.1',
                    'user-agent': 'Test Agent',
                },
            };

            // Act
            await controller.register(registerDto, requestWithForwardedFor);

            // Assert
            expect(authService.register).toHaveBeenCalledWith(
                registerDto,
                '203.0.113.1', // First IP from x-forwarded-for
                'Test Agent'
            );
        });

        it('should use default IP when no IP is available', async () => {
            // Arrange
            authService.register.mockResolvedValue(mockAuthResponse);
            const requestWithoutIp = {
                headers: { 'user-agent': 'Test Agent' },
            };

            // Act
            await controller.register(registerDto, requestWithoutIp);

            // Assert
            expect(authService.register).toHaveBeenCalledWith(
                registerDto,
                '::1', // Default IP
                'Test Agent'
            );
        });

        it('should use default user agent when not provided', async () => {
            // Arrange
            authService.register.mockResolvedValue(mockAuthResponse);
            const requestWithoutUserAgent = {
                ip: '127.0.0.1',
                headers: {},
            };

            // Act
            await controller.register(registerDto, requestWithoutUserAgent);

            // Assert
            expect(authService.register).toHaveBeenCalledWith(
                registerDto,
                '127.0.0.1',
                'Unknown' // Default user agent
            );
        });

        it('should propagate ConflictException from AuthService', async () => {
            // Arrange
            const conflictError = new ConflictException('Пользователь с таким email уже существует');
            authService.register.mockRejectedValue(conflictError);

            // Act & Assert
            await expect(controller.register(registerDto, mockRequest))
                .rejects
                .toThrow(ConflictException);

            expect(authService.register).toHaveBeenCalledWith(
                registerDto,
                '127.0.0.1',
                'Test Agent'
            );
        });

        it('should propagate other errors from AuthService', async () => {
            // Arrange
            const serviceError = new Error('Service unavailable');
            authService.register.mockRejectedValue(serviceError);

            // Act & Assert
            await expect(controller.register(registerDto, mockRequest))
                .rejects
                .toThrow('Service unavailable');

            expect(authService.register).toHaveBeenCalledWith(
                registerDto,
                '127.0.0.1',
                'Test Agent'
            );
        });

        it('should handle request with all IP extraction methods', async () => {
            // Arrange
            authService.register.mockResolvedValue(mockAuthResponse);
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
            await controller.register(registerDto, complexRequest);

            // Assert - Should prefer request.ip first
            expect(authService.register).toHaveBeenCalledWith(
                registerDto,
                '10.0.0.1',
                'Mozilla/5.0 Test Agent'
            );
        });
    });

    describe('IP and User Agent extraction methods', () => {
        const testRegisterDto: RegisterDto = {
            name: 'Test User',
            email: 'test@example.com',
            password: 'TestPass123!',
        };

        it('should extract client IP correctly with priority order', async () => {
            // Test the private method behavior through public method calls
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
                authService.register.mockResolvedValue(mockAuthResponse);

                await controller.register(testRegisterDto, request);

                expect(authService.register).toHaveBeenCalledWith(
                    testRegisterDto,
                    expected,
                    expect.any(String)
                );

                jest.clearAllMocks();
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
                authService.register.mockResolvedValue(mockAuthResponse);

                await controller.register(testRegisterDto, request);

                expect(authService.register).toHaveBeenCalledWith(
                    testRegisterDto,
                    expect.any(String),
                    expected
                );

                jest.clearAllMocks();
            }
        });
    });
});