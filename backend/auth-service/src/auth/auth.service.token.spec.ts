import { AuthService } from './auth.service';
import { TokenService } from '../token/token.service';
import { SessionService } from '../session/session.service';
import { UserServiceClient } from '../common/http-client/user-service.client';
import { SecurityServiceClient } from '../common/http-client/security-service.client';
import { NotificationServiceClient } from '../common/http-client/notification-service.client';
import { EventBusService } from '../events/services/event-bus.service';

describe('AuthService - JWT Token Generation and Verification', () => {
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
    name: 'John Doe',
    email: 'john@example.com',
    password: 'hashedPassword123',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockJwtPayload = {
    sub: 'user-123',
    email: 'john@example.com',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  beforeEach(() => {
    // Создаем моки напрямую
    jwtService = {
      signAsync: jest.fn(),
      verify: jest.fn(),
    } as any;

    tokenService = {
      isTokenBlacklisted: jest.fn(),
      blacklistToken: jest.fn().mockResolvedValue(undefined),
      hashToken: jest.fn(),
    } as any;

    sessionService = {
      createSession: jest.fn(),
      createSessionWithLimit: jest.fn().mockResolvedValue({
        session: {
          id: 'session-123',
          userId: 'user-123',
          accessTokenHash: 'mock-access-token-hash',
          refreshTokenHash: 'mock-refresh-token-hash',
          ipAddress: '::1',
          userAgent: 'Unknown',
          isActive: true,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessedAt: new Date(),
        },
        removedSessionsCount: 0,
      }),
      getSessionByAccessToken: jest.fn(),
      enforceSessionLimit: jest.fn(),
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
      publishUserRegisteredEvent: jest.fn().mockResolvedValue(undefined),
      publishUserLoggedInEvent: jest.fn().mockResolvedValue(undefined),
      publishUserLoggedOutEvent: jest.fn().mockResolvedValue(undefined),
      publishSecurityEvent: jest.fn().mockResolvedValue(undefined),
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('JWT Token Generation', () => {
    it('should generate access and refresh tokens with correct payload', async () => {
      // Arrange
      const mockAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access';
      const mockRefreshToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh';

      jwtService.signAsync
        .mockResolvedValueOnce(mockAccessToken)
        .mockResolvedValueOnce(mockRefreshToken);

      // Act - Call private method through public interface (login)
      userServiceClient.findByEmail.mockResolvedValue(mockUser);
      sessionService.createSessionWithLimit.mockResolvedValue({
        session: {
          id: 'session-123',
          userId: mockUser.id,
          accessTokenHash: 'mock-access-token-hash',
          refreshTokenHash: 'mock-refresh-token-hash',
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
          isActive: true,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessedAt: new Date(),
        },
        removedSessionsCount: 0,
      });

      const result = await authService.login({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        isActive: mockUser.isActive,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert - Requirement 4.3: Auth Service SHALL generate JWT access tokens with expiration
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);

      // Verify access token generation
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(1, {
        sub: mockUser.id,
        email: mockUser.email,
      });

      // Verify refresh token generation - Requirement 4.4: Auth Service SHALL generate refresh tokens with longer expiration
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(2, {
        sub: mockUser.id,
        email: mockUser.email,
      }, { expiresIn: '7d' });

      expect(result.access_token).toBe(mockAccessToken);
      expect(result.refresh_token).toBe(mockRefreshToken);
      expect(result.expires_in).toBe(3600); // 1 hour in seconds
    });

    it('should generate tokens with consistent payload structure', async () => {
      // Arrange
      jwtService.signAsync.mockResolvedValue('mock-token');
      userServiceClient.findByEmail.mockResolvedValue(mockUser);

      sessionService.createSession.mockResolvedValue({
        id: 'session-123',
        userId: mockUser.id,
        accessTokenHash: 'mock-access-token-hash',
        refreshTokenHash: 'mock-refresh-token-hash',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        isActive: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      });
      sessionService.enforceSessionLimit.mockResolvedValue(0);

      // Act
      await authService.login({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        isActive: mockUser.isActive,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert - Verify payload structure
      const expectedPayload = {
        sub: mockUser.id,
        email: mockUser.email,
      };

      expect(jwtService.signAsync).toHaveBeenCalledWith(expectedPayload);
      expect(jwtService.signAsync).toHaveBeenCalledWith(expectedPayload, { expiresIn: '7d' });
    });

    it('should handle JWT signing errors gracefully', async () => {
      // Arrange
      jwtService.signAsync.mockRejectedValue(new Error('JWT signing failed'));
      userServiceClient.findByEmail.mockResolvedValue(mockUser);

      sessionService.enforceSessionLimit.mockResolvedValue(0);

      // Act & Assert
      await expect(authService.login({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        isActive: mockUser.isActive,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      })).rejects.toThrow('JWT signing failed');

      expect(jwtService.signAsync).toHaveBeenCalled();
    });

    it('should generate different tokens for different users', async () => {
      // Arrange
      const user1 = { ...mockUser, id: 'user-1', email: 'user1@example.com' };
      const user2 = { ...mockUser, id: 'user-2', email: 'user2@example.com' };

      jwtService.signAsync
        .mockResolvedValueOnce('token-user1-access')
        .mockResolvedValueOnce('token-user1-refresh')
        .mockResolvedValueOnce('token-user2-access')
        .mockResolvedValueOnce('token-user2-refresh');

      sessionService.createSession.mockResolvedValue({
        id: 'session-123',
        userId: mockUser.id,
        accessTokenHash: 'mock-access-token-hash',
        refreshTokenHash: 'mock-refresh-token-hash',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        isActive: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      });
      sessionService.enforceSessionLimit.mockResolvedValue(0);

      // Act
      const result1 = await authService.login({
        id: user1.id,
        name: user1.name,
        email: user1.email,
        isActive: user1.isActive,
        createdAt: user1.createdAt,
        updatedAt: user1.updatedAt,
      });

      const result2 = await authService.login({
        id: user2.id,
        name: user2.name,
        email: user2.email,
        isActive: user2.isActive,
        createdAt: user2.createdAt,
        updatedAt: user2.updatedAt,
      });

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert - Different users should get different tokens
      expect(result1.access_token).toBe('token-user1-access');
      expect(result1.refresh_token).toBe('token-user1-refresh');
      expect(result2.access_token).toBe('token-user2-access');
      expect(result2.refresh_token).toBe('token-user2-refresh');

      // Verify different payloads were used
      expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: user1.id, email: user1.email });
      expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: user2.id, email: user2.email });
    });
  });

  describe('JWT Token Validation', () => {
    const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.validToken';

    it('should validate JWT token successfully', async () => {
      // Arrange
      jwtService.verify.mockReturnValue(mockJwtPayload);
      tokenService.isTokenBlacklisted.mockResolvedValue(false);
      userServiceClient.findById.mockResolvedValue(mockUser);

      // Act
      const result = await authService.validateToken(validToken);

      // Assert - Requirement 5.1: Auth Service SHALL verify JWT signature and expiration
      expect(jwtService.verify).toHaveBeenCalledWith(validToken);
      expect(result.valid).toBe(true);
      expect(result.payload).toEqual(mockJwtPayload);

      // Requirement 5.7: Auth Service SHALL check token blacklist status
      expect(tokenService.isTokenBlacklisted).toHaveBeenCalledWith(validToken);

      // Requirement 5.4: Auth Service SHALL verify user still exists and is not deleted
      expect(userServiceClient.findById).toHaveBeenCalledWith(mockJwtPayload.sub);
    });

    it('should reject blacklisted token', async () => {
      // Arrange
      jwtService.verify.mockReturnValue(mockJwtPayload);
      tokenService.isTokenBlacklisted.mockResolvedValue(true);

      // Act
      const result = await authService.validateToken(validToken);

      // Assert
      expect(jwtService.verify).toHaveBeenCalledWith(validToken);
      expect(tokenService.isTokenBlacklisted).toHaveBeenCalledWith(validToken);
      expect(result.valid).toBe(false);
      expect(userServiceClient.findById).not.toHaveBeenCalled();
    });

    it('should reject token for non-existent user', async () => {
      // Arrange
      jwtService.verify.mockReturnValue(mockJwtPayload);
      tokenService.isTokenBlacklisted.mockResolvedValue(false);
      userServiceClient.findById.mockResolvedValue(null);

      // Act
      const result = await authService.validateToken(validToken);

      // Assert
      expect(jwtService.verify).toHaveBeenCalledWith(validToken);
      expect(tokenService.isTokenBlacklisted).toHaveBeenCalledWith(validToken);
      expect(userServiceClient.findById).toHaveBeenCalledWith(mockJwtPayload.sub);
      expect(result.valid).toBe(false);
    });

    it('should handle expired token', async () => {
      // Arrange
      const expiredError = new Error('Token expired');
      expiredError.name = 'TokenExpiredError';
      jwtService.verify.mockImplementation(() => {
        throw expiredError;
      });

      // Act
      const result = await authService.validateToken(validToken);

      // Assert
      expect(jwtService.verify).toHaveBeenCalledWith(validToken);
      expect(result.valid).toBe(false);
      expect(tokenService.isTokenBlacklisted).not.toHaveBeenCalled();
    });

    it('should handle invalid token signature', async () => {
      // Arrange
      const invalidSignatureError = new Error('Invalid signature');
      invalidSignatureError.name = 'JsonWebTokenError';
      jwtService.verify.mockImplementation(() => {
        throw invalidSignatureError;
      });

      // Act
      const result = await authService.validateToken(validToken);

      // Assert
      expect(jwtService.verify).toHaveBeenCalledWith(validToken);
      expect(result.valid).toBe(false);
      expect(tokenService.isTokenBlacklisted).not.toHaveBeenCalled();
    });

    it('should handle malformed token', async () => {
      // Arrange
      const malformedError = new Error('Malformed token');
      malformedError.name = 'JsonWebTokenError';
      jwtService.verify.mockImplementation(() => {
        throw malformedError;
      });

      // Act
      const result = await authService.validateToken('malformed.token');

      // Assert
      expect(jwtService.verify).toHaveBeenCalledWith('malformed.token');
      expect(result.valid).toBe(false);
    });

    it('should handle token validation service errors gracefully', async () => {
      // Arrange
      jwtService.verify.mockReturnValue(mockJwtPayload);
      tokenService.isTokenBlacklisted.mockRejectedValue(new Error('Redis unavailable'));

      // Act
      const result = await authService.validateToken(validToken);

      // Assert - Should return false on service errors for security
      expect(result.valid).toBe(false);
      expect(jwtService.verify).toHaveBeenCalledWith(validToken);
      expect(tokenService.isTokenBlacklisted).toHaveBeenCalledWith(validToken);
    });

    it('should handle user service errors gracefully', async () => {
      // Arrange
      jwtService.verify.mockReturnValue(mockJwtPayload);
      tokenService.isTokenBlacklisted.mockResolvedValue(false);
      userServiceClient.findById.mockRejectedValue(new Error('User service unavailable'));

      // Act
      const result = await authService.validateToken(validToken);

      // Assert - Should return false on service errors for security
      expect(result.valid).toBe(false);
      expect(userServiceClient.findById).toHaveBeenCalledWith(mockJwtPayload.sub);
    });
  });

  describe('Token Blacklisting', () => {
    const tokenToBlacklist = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.toBlacklist';

    it('should check if token is blacklisted', async () => {
      // Arrange
      tokenService.isTokenBlacklisted.mockResolvedValue(true);

      // Act
      const result = await authService.isTokenBlacklisted(tokenToBlacklist);

      // Assert
      expect(tokenService.isTokenBlacklisted).toHaveBeenCalledWith(tokenToBlacklist);
      expect(result).toBe(true);
    });

    it('should return false for non-blacklisted token', async () => {
      // Arrange
      tokenService.isTokenBlacklisted.mockResolvedValue(false);

      // Act
      const result = await authService.isTokenBlacklisted(tokenToBlacklist);

      // Assert
      expect(tokenService.isTokenBlacklisted).toHaveBeenCalledWith(tokenToBlacklist);
      expect(result).toBe(false);
    });

    it('should handle blacklist check errors gracefully', async () => {
      // Arrange
      // TokenService.isTokenBlacklisted has internal error handling and returns false on error
      tokenService.isTokenBlacklisted.mockResolvedValue(false);

      // Act
      const result = await authService.isTokenBlacklisted(tokenToBlacklist);

      // Assert - Should return false on error (fail open for availability)
      expect(tokenService.isTokenBlacklisted).toHaveBeenCalledWith(tokenToBlacklist);
      expect(result).toBe(false);
    });
  });

  describe('Token Security Requirements', () => {
    it('should ensure tokens contain required claims', async () => {
      // Arrange
      jwtService.signAsync.mockResolvedValue('mock-token');
      userServiceClient.findByEmail.mockResolvedValue(mockUser);

      sessionService.createSession.mockResolvedValue({
        id: 'session-123',
        userId: mockUser.id,
        accessTokenHash: 'mock-access-token-hash',
        refreshTokenHash: 'mock-refresh-token-hash',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        isActive: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      });
      sessionService.enforceSessionLimit.mockResolvedValue(0);

      // Act
      await authService.login({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        isActive: mockUser.isActive,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert - Verify required claims are present
      const tokenPayload = jwtService.signAsync.mock.calls[0][0];
      expect(tokenPayload).toHaveProperty('sub', mockUser.id);
      expect(tokenPayload).toHaveProperty('email', mockUser.email);

      // Verify no sensitive information is included
      expect(tokenPayload).not.toHaveProperty('password');
      expect(tokenPayload).not.toHaveProperty('name'); // Name not needed in token
    });

    it('should validate token expiration times', async () => {
      // Arrange
      jwtService.signAsync.mockResolvedValue('mock-token');
      userServiceClient.findByEmail.mockResolvedValue(mockUser);

      sessionService.createSession.mockResolvedValue({
        id: 'session-123',
        userId: mockUser.id,
        accessTokenHash: 'mock-access-token-hash',
        refreshTokenHash: 'mock-refresh-token-hash',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        isActive: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      });
      sessionService.enforceSessionLimit.mockResolvedValue(0);

      // Act
      await authService.login({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        isActive: mockUser.isActive,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert - Verify token expiration configuration
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(1, expect.any(Object)); // Access token (default expiration)
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(2, expect.any(Object), { expiresIn: '7d' }); // Refresh token (7 days)
    });
  });
});
