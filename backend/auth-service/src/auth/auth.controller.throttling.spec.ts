import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController Throttling', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockAuthService = {
    register: jest.fn(),
    validateUser: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    validateToken: jest.fn(),
    logFailedLoginAttempt: jest.fn(),
  };

  beforeEach(async () => {
    authService = mockAuthService as any;
    controller = new AuthController(authService);
  });

  describe('register', () => {
    it('should successfully register user', async () => {
      // Arrange
      const registerDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'StrongPass123!',
      };

      const expectedResult = {
        user: { id: '1', email: 'test@example.com', name: 'Test User' },
        access_token: 'token',
        refresh_token: 'refresh',
        session_id: 'session',
        expires_in: 3600,
      };

      mockAuthService.register.mockResolvedValue(expectedResult);

      const mockRequest = { ip: '192.168.1.1', headers: { 'user-agent': 'test-agent' } };

      // Act
      const result = await controller.register(registerDto, mockRequest);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockAuthService.register).toHaveBeenCalledWith(
        registerDto,
        '192.168.1.1',
        'test-agent',
      );
    });

    it('should handle registration errors', async () => {
      // Arrange
      const registerDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'StrongPass123!',
      };

      mockAuthService.register.mockRejectedValue(new Error('Registration failed'));

      const mockRequest = { ip: '192.168.1.1', headers: { 'user-agent': 'test-agent' } };

      // Act & Assert
      await expect(
        controller.register(registerDto, mockRequest),
      ).rejects.toThrow('Registration failed');
    });
  });

  describe('login', () => {
    it('should successfully login user', async () => {
      // Arrange
      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const expectedResult = {
        user: { id: '1', email: 'test@example.com', name: 'Test User' },
        access_token: 'token',
        refresh_token: 'refresh',
        session_id: 'session',
        expires_in: 3600,
      };

      mockAuthService.validateUser.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
      });

      mockAuthService.login.mockResolvedValue(expectedResult);

      const mockRequest = { ip: '192.168.1.1', headers: { 'user-agent': 'test-agent' } };

      // Act
      const result = await controller.login(loginDto, mockRequest);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockAuthService.validateUser).toHaveBeenCalledWith(
        loginDto.email,
        loginDto.password,
      );
      expect(mockAuthService.login).toHaveBeenCalledWith(
        { id: '1', email: 'test@example.com', name: 'Test User' },
        '192.168.1.1',
        'test-agent',
      );
    });

    it('should handle login errors', async () => {
      // Arrange
      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      mockAuthService.validateUser.mockRejectedValue(new Error('Invalid credentials'));

      const mockRequest = { ip: '192.168.1.1', headers: { 'user-agent': 'test-agent' } };

      // Act & Assert
      await expect(
        controller.login(loginDto, mockRequest),
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('validateToken', () => {
    it('should successfully validate token', async () => {
      // Arrange
      const validateDto = {
        token: 'valid-jwt-token',
      };

      const expectedResult = {
        valid: true,
        user: { id: '1', email: 'test@example.com' },
      };

      mockAuthService.validateToken.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.validateToken(validateDto);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockAuthService.validateToken).toHaveBeenCalledWith(validateDto.token);
    });

    it('should handle validation errors', async () => {
      // Arrange
      const validateDto = {
        token: 'invalid-jwt-token',
      };

      mockAuthService.validateToken.mockRejectedValue(new Error('Invalid token'));

      // Act & Assert
      await expect(
        controller.validateToken(validateDto),
      ).rejects.toThrow('Invalid token');
    });
  });

  describe('controller functionality', () => {
    it('should properly call auth service methods', async () => {
      // Arrange
      const registerDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'StrongPass123!',
      };

      mockAuthService.register.mockResolvedValue({
        user: { id: '1', email: 'test@example.com', name: 'Test User' },
        access_token: 'token',
        refresh_token: 'refresh',
        session_id: 'session',
        expires_in: 3600,
      });

      const mockRequest = { ip: '192.168.1.1', headers: { 'user-agent': 'test-agent' } };

      // Act
      await controller.register(registerDto, mockRequest);

      // Assert
      expect(mockAuthService.register).toHaveBeenCalledTimes(1);
      expect(mockAuthService.register).toHaveBeenCalledWith(
        registerDto,
        '192.168.1.1',
        'test-agent',
      );
    });
  });
});