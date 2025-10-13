import { AuthService } from './auth.service';
import { TokenService } from '../token/token.service';
import { SessionService } from '../session/session.service';
import { UserServiceClient } from '../common/http-client/user-service.client';
import { SecurityServiceClient } from '../common/http-client/security-service.client';
import { NotificationServiceClient } from '../common/http-client/notification-service.client';
import { EventBusService } from '../events/services/event-bus.service';

describe('AuthService - Password Hashing and Validation', () => {
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

  const fixedDate = new Date('2025-10-13T09:16:45.358Z');
  const mockUser = {
    id: 'user-123',
    name: 'John Doe',
    email: 'john@example.com',
    password: '$2b$10$hashedPasswordExample123456789',
    isActive: true,
    createdAt: fixedDate,
    updatedAt: fixedDate,
  };

  beforeEach(() => {
    // Создаем моки напрямую
    jwtService = {
      signAsync: jest.fn(),
      verify: jest.fn(),
    } as any;

    tokenService = {
      generateTokens: jest.fn(),
      blacklistToken: jest.fn(),
      hashToken: jest.fn(),
    } as any;

    sessionService = {
      createSession: jest.fn().mockResolvedValue({
        id: 'session-123',
        userId: 'user-123',
        accessTokenHash: 'mock-access-token-hash',
        refreshTokenHash: 'mock-refresh-token-hash',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        isActive: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      }),
      createSessionWithLimit: jest.fn(),
      getSessionByAccessToken: jest.fn(),
      enforceSessionLimit: jest.fn().mockResolvedValue(0),
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

    // Mock password hashing and comparison through worker process
    workerProcess.executeInWorker.mockImplementation(async (operation: string, data: any) => {
      if (operation === 'hash-password') {
        return '$2b$10$hashedPasswordExample123456789';
      }
      if (operation === 'compare-password') {
        return true; // Default to true, tests can override
      }
      return undefined;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Password Hashing', () => {
    it('should hash password with bcrypt during registration', async () => {
      // Arrange
      const plainPassword = 'StrongPassword123!';
      const hashedPassword = '$2b$10$hashedPasswordExample123456789';

      userServiceClient.findByEmail.mockResolvedValue(null);
      userServiceClient.createUser.mockResolvedValue(mockUser);

      // Mock worker process to return a known hash
      workerProcess.executeInWorker.mockResolvedValue(hashedPassword);

      // Act
      await authService.register({
        name: 'John Doe',
        email: 'john@example.com',
        password: plainPassword,
      });

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert - Requirement 4.1: Auth Service SHALL hash passwords using bcrypt with salt rounds
      expect(workerProcess.executeInWorker).toHaveBeenCalledWith('hash-password', {
        password: plainPassword,
        saltRounds: 10
      });
      expect(userServiceClient.createUser).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@example.com',
        password: hashedPassword, // Pre-hashed password sent to User Service
      });
    });

    it('should use salt rounds of 10 for password hashing', async () => {
      // Arrange
      const plainPassword = 'TestPassword123!';
      userServiceClient.findByEmail.mockResolvedValue(null);
      userServiceClient.createUser.mockResolvedValue(mockUser);

      workerProcess.executeInWorker.mockResolvedValue('hashed');

      // Act
      await authService.register({
        name: 'Test User',
        email: 'test@example.com',
        password: plainPassword,
      });

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert - Verify salt rounds parameter
      expect(workerProcess.executeInWorker).toHaveBeenCalledWith('hash-password', {
        password: plainPassword,
        saltRounds: 10
      });
    });

    it('should handle bcrypt hashing errors during registration', async () => {
      // Arrange
      const plainPassword = 'TestPassword123!';
      userServiceClient.findByEmail.mockResolvedValue(null);

      workerProcess.executeInWorker.mockRejectedValue(new Error('Hashing failed'));

      // Act & Assert
      await expect(authService.register({
        name: 'Test User',
        email: 'test@example.com',
        password: plainPassword,
      })).rejects.toThrow('Hashing failed');

      expect(workerProcess.executeInWorker).toHaveBeenCalledWith('hash-password', {
        password: plainPassword,
        saltRounds: 10
      });
      expect(userServiceClient.createUser).not.toHaveBeenCalled();
    });
  });

  describe('Password Validation', () => {
    it('should validate correct password during login', async () => {
      // Arrange
      const plainPassword = 'CorrectPassword123!';
      const hashedPassword = '$2b$10$hashedPasswordExample123456789';

      const userWithPassword = { ...mockUser, password: hashedPassword };
      userServiceClient.findByEmail.mockResolvedValue(userWithPassword);

      // Mock worker process to return true for correct password
      workerProcess.executeInWorker.mockResolvedValue(true);

      // Act
      const result = await authService.validateUser('john@example.com', plainPassword);

      // Assert - Requirement 4.2: Auth Service SHALL verify password against stored hash
      expect(workerProcess.executeInWorker).toHaveBeenCalledWith('compare-password', {
        password: plainPassword,
        hash: hashedPassword
      });
      expect(result).toEqual({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        isActive: mockUser.isActive,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
      expect(result).not.toHaveProperty('password'); // Password should be excluded
    });

    it('should reject incorrect password during login', async () => {
      // Arrange
      const plainPassword = 'WrongPassword123!';
      const hashedPassword = '$2b$10$hashedPasswordExample123456789';

      const userWithPassword = { ...mockUser, password: hashedPassword };
      userServiceClient.findByEmail.mockResolvedValue(userWithPassword);

      // Mock worker process to return false for incorrect password
      workerProcess.executeInWorker.mockResolvedValue(false);

      // Act
      const result = await authService.validateUser('john@example.com', plainPassword);

      // Assert
      expect(workerProcess.executeInWorker).toHaveBeenCalledWith('compare-password', {
        password: plainPassword,
        hash: hashedPassword
      });
      expect(result).toBeNull();
    });

    it('should handle bcrypt comparison errors gracefully', async () => {
      // Arrange
      const plainPassword = 'TestPassword123!';
      const hashedPassword = '$2b$10$hashedPasswordExample123456789';

      const userWithPassword = { ...mockUser, password: hashedPassword };
      userServiceClient.findByEmail.mockResolvedValue(userWithPassword);

      workerProcess.executeInWorker.mockRejectedValue(new Error('Comparison failed'));

      // Act
      const result = await authService.validateUser('john@example.com', plainPassword);

      // Assert - Should return null on error to prevent authentication
      expect(workerProcess.executeInWorker).toHaveBeenCalledWith('compare-password', {
        password: plainPassword,
        hash: hashedPassword
      });
      expect(result).toBeNull();
    });

    it('should validate password with different hash formats', async () => {
      // Arrange
      const plainPassword = 'TestPassword123!';
      const differentHashFormats = [
        '$2a$10$hashedPasswordExample123456789', // bcrypt 2a
        '$2b$10$hashedPasswordExample123456789', // bcrypt 2b
        '$2y$10$hashedPasswordExample123456789', // bcrypt 2y
      ];

      for (const hashedPassword of differentHashFormats) {
        const userWithPassword = { ...mockUser, password: hashedPassword };
        userServiceClient.findByEmail.mockResolvedValue(userWithPassword);
        workerProcess.executeInWorker.mockResolvedValue(true);

        // Act
        const result = await authService.validateUser('john@example.com', plainPassword);

        // Assert
        expect(workerProcess.executeInWorker).toHaveBeenCalledWith('compare-password', {
          password: plainPassword,
          hash: hashedPassword
        });
        expect(result).not.toBeNull();
        expect(result?.email).toBe('john@example.com');

        // Reset mocks for next iteration
        jest.clearAllMocks();
      }
    });

    it('should handle empty password validation', async () => {
      // Arrange
      const emptyPassword = '';
      userServiceClient.findByEmail.mockResolvedValue(mockUser);
      workerProcess.executeInWorker.mockResolvedValue(false);

      // Act
      const result = await authService.validateUser('john@example.com', emptyPassword);

      // Assert - Should call worker process for empty password and return null
      expect(workerProcess.executeInWorker).toHaveBeenCalledWith('compare-password', {
        password: emptyPassword,
        hash: mockUser.password
      });
      expect(result).toBeNull(); // Worker process will handle empty password appropriately
    });

    it('should handle null password validation', async () => {
      // Arrange
      const nullPassword = null as any;
      userServiceClient.findByEmail.mockResolvedValue(mockUser);
      workerProcess.executeInWorker.mockResolvedValue(false);

      // Act
      const result = await authService.validateUser('john@example.com', nullPassword);

      // Assert - Should handle null password gracefully and return null
      expect(workerProcess.executeInWorker).toHaveBeenCalledWith('compare-password', {
        password: nullPassword,
        hash: mockUser.password
      });
      expect(result).toBeNull();
    });
  });

  describe('Password Security Requirements', () => {
    it('should ensure password is never stored in plain text', async () => {
      // Arrange
      const plainPassword = 'PlainTextPassword123!';
      userServiceClient.findByEmail.mockResolvedValue(null);
      userServiceClient.createUser.mockResolvedValue(mockUser);

      workerProcess.executeInWorker.mockResolvedValue('$2b$10$hashedPassword');

      // Act
      await authService.register({
        name: 'Test User',
        email: 'test@example.com',
        password: plainPassword,
      });

      // Wait for setImmediate events to complete
      await new Promise(resolve => setImmediate(resolve));

      // Assert - Verify plain text password is never passed to User Service
      expect(userServiceClient.createUser).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        password: '$2b$10$hashedPassword', // Hashed password
      });

      // Verify the call does not contain plain text password
      const createUserCall = userServiceClient.createUser.mock.calls[0][0];
      expect(createUserCall.password).not.toBe(plainPassword);
      expect(createUserCall.password).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt hash format
    });

    it('should use consistent salt rounds across all password operations', async () => {
      // Arrange
      const passwords = ['Password1!', 'AnotherPass2@', 'ThirdPassword3#'];
      userServiceClient.findByEmail.mockResolvedValue(null);
      userServiceClient.createUser.mockResolvedValue(mockUser);

      workerProcess.executeInWorker.mockResolvedValue('hashed');

      // Act - Register multiple users
      for (let i = 0; i < passwords.length; i++) {
        await authService.register({
          name: `User ${i}`,
          email: `user${i}@example.com`,
          password: passwords[i],
        });
        // Wait for setImmediate events to complete
        await new Promise(resolve => setImmediate(resolve));
      }

      // Assert - All passwords should use same salt rounds (10)
      expect(workerProcess.executeInWorker).toHaveBeenCalledTimes(passwords.length);
      for (let i = 0; i < passwords.length; i++) {
        expect(workerProcess.executeInWorker).toHaveBeenNthCalledWith(i + 1, 'hash-password', {
          password: passwords[i],
          saltRounds: 10
        });
      }
    });

    it('should handle password validation timing attacks consistently', async () => {
      // Arrange
      const plainPassword = 'TestPassword123!';

      // Test with existing user but wrong password
      userServiceClient.findByEmail.mockResolvedValueOnce(mockUser);
      workerProcess.executeInWorker.mockResolvedValueOnce(false); // Wrong password

      const startTime1 = Date.now();
      const result1 = await authService.validateUser('existing@example.com', plainPassword);
      const endTime1 = Date.now();

      // Test with non-existing user
      userServiceClient.findByEmail.mockResolvedValueOnce(null);

      const startTime2 = Date.now();
      const result2 = await authService.validateUser('nonexistent@example.com', plainPassword);
      const endTime2 = Date.now();

      // Assert - Both should return null
      expect(result1).toBeNull();
      expect(result2).toBeNull();

      // Timing should be reasonably similar (within 100ms difference)
      // This is a basic check - in production, more sophisticated timing attack prevention might be needed
      const timeDiff1 = endTime1 - startTime1;
      const timeDiff2 = endTime2 - startTime2;
      expect(Math.abs(timeDiff1 - timeDiff2)).toBeLessThan(100);
    });
  });
});
