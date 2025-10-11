import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { TokenService } from '../token/token.service';
import { SessionService } from '../session/session.service';
import { UserServiceClient } from '../common/http-client/user-service.client';
import { SecurityServiceClient } from '../common/http-client/security-service.client';
import { NotificationServiceClient } from '../common/http-client/notification-service.client';
import { EventBusService } from '../events/services/event-bus.service';

describe('AuthService - Password Hashing and Validation', () => {
  let authService: AuthService;
  let userServiceClient: jest.Mocked<UserServiceClient>;

  const mockUser = {
    id: 'user-123',
    name: 'John Doe',
    email: 'john@example.com',
    password: '$2b$10$hashedPasswordExample123456789',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: TokenService,
          useValue: {
            generateTokens: jest.fn(),
            blacklistToken: jest.fn(),
          },
        },
        {
          provide: SessionService,
          useValue: {
            createSession: jest.fn().mockResolvedValue({
              id: 'session-123',
              userId: 'user-123',
              accessToken: 'mock-access-token',
              refreshToken: 'mock-refresh-token',
              ipAddress: '127.0.0.1',
              userAgent: 'Test Agent',
              isActive: true,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              createdAt: new Date(),
              updatedAt: new Date(),
              lastAccessedAt: new Date(),
            }),
            getSessionByAccessToken: jest.fn(),
            enforceSessionLimit: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: UserServiceClient,
          useValue: {
            findByEmail: jest.fn(),
            createUser: jest.fn(),
          },
        },
        {
          provide: SecurityServiceClient,
          useValue: {
            logSecurityEvent: jest.fn(),
          },
        },
        {
          provide: NotificationServiceClient,
          useValue: {
            sendWelcomeNotification: jest.fn(),
          },
        },
        {
          provide: EventBusService,
          useValue: {
            publishUserRegisteredEvent: jest.fn(),
            publishUserLoggedInEvent: jest.fn(),
            publishUserLoggedOutEvent: jest.fn(),
            publishSecurityEvent: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(5), // MAX_SESSIONS_PER_USER
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userServiceClient = module.get(UserServiceClient);
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
      
      // Mock bcrypt.hash to return a known hash
      jest.spyOn(bcrypt, 'hash').mockResolvedValue(hashedPassword as never);

      // Act
      await authService.register({
        name: 'John Doe',
        email: 'john@example.com',
        password: plainPassword,
      });

      // Assert - Requirement 4.1: Auth Service SHALL hash passwords using bcrypt with salt rounds
      expect(bcrypt.hash).toHaveBeenCalledWith(plainPassword, 10);
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
      
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed' as never);

      // Act
      await authService.register({
        name: 'Test User',
        email: 'test@example.com',
        password: plainPassword,
      });

      // Assert - Verify salt rounds parameter
      expect(bcrypt.hash).toHaveBeenCalledWith(plainPassword, 10);
    });

    it('should handle bcrypt hashing errors during registration', async () => {
      // Arrange
      const plainPassword = 'TestPassword123!';
      userServiceClient.findByEmail.mockResolvedValue(null);
      
      jest.spyOn(bcrypt, 'hash').mockRejectedValue(new Error('Hashing failed') as never);

      // Act & Assert
      await expect(authService.register({
        name: 'Test User',
        email: 'test@example.com',
        password: plainPassword,
      })).rejects.toThrow('Hashing failed');

      expect(bcrypt.hash).toHaveBeenCalledWith(plainPassword, 10);
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
      
      // Mock bcrypt.compare to return true for correct password
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      // Act
      const result = await authService.validateUser('john@example.com', plainPassword);

      // Assert - Requirement 4.2: Auth Service SHALL verify password against stored hash
      expect(bcrypt.compare).toHaveBeenCalledWith(plainPassword, hashedPassword);
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
      
      // Mock bcrypt.compare to return false for incorrect password
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      // Act
      const result = await authService.validateUser('john@example.com', plainPassword);

      // Assert
      expect(bcrypt.compare).toHaveBeenCalledWith(plainPassword, hashedPassword);
      expect(result).toBeNull();
    });

    it('should handle bcrypt comparison errors gracefully', async () => {
      // Arrange
      const plainPassword = 'TestPassword123!';
      const hashedPassword = '$2b$10$hashedPasswordExample123456789';
      
      const userWithPassword = { ...mockUser, password: hashedPassword };
      userServiceClient.findByEmail.mockResolvedValue(userWithPassword);
      
      jest.spyOn(bcrypt, 'compare').mockRejectedValue(new Error('Comparison failed') as never);

      // Act
      const result = await authService.validateUser('john@example.com', plainPassword);

      // Assert - Should return null on error to prevent authentication
      expect(bcrypt.compare).toHaveBeenCalledWith(plainPassword, hashedPassword);
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
        jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

        // Act
        const result = await authService.validateUser('john@example.com', plainPassword);

        // Assert
        expect(bcrypt.compare).toHaveBeenCalledWith(plainPassword, hashedPassword);
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
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      // Act
      const result = await authService.validateUser('john@example.com', emptyPassword);

      // Assert - Should call bcrypt.compare for empty password and return null
      expect(bcrypt.compare).toHaveBeenCalledWith(emptyPassword, mockUser.password);
      expect(result).toBeNull(); // bcrypt.compare will handle empty password appropriately
    });

    it('should handle null password validation', async () => {
      // Arrange
      const nullPassword = null as any;
      userServiceClient.findByEmail.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      // Act
      const result = await authService.validateUser('john@example.com', nullPassword);

      // Assert - Should handle null password gracefully and return null
      expect(bcrypt.compare).toHaveBeenCalledWith(nullPassword, mockUser.password);
      expect(result).toBeNull();
    });
  });

  describe('Password Security Requirements', () => {
    it('should ensure password is never stored in plain text', async () => {
      // Arrange
      const plainPassword = 'PlainTextPassword123!';
      userServiceClient.findByEmail.mockResolvedValue(null);
      userServiceClient.createUser.mockResolvedValue(mockUser);
      
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('$2b$10$hashedPassword' as never);

      // Act
      await authService.register({
        name: 'Test User',
        email: 'test@example.com',
        password: plainPassword,
      });

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
      
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed' as never);

      // Act - Register multiple users
      for (let i = 0; i < passwords.length; i++) {
        await authService.register({
          name: `User ${i}`,
          email: `user${i}@example.com`,
          password: passwords[i],
        });
      }

      // Assert - All passwords should use same salt rounds (10)
      expect(bcrypt.hash).toHaveBeenCalledTimes(passwords.length);
      for (let i = 0; i < passwords.length; i++) {
        expect(bcrypt.hash).toHaveBeenNthCalledWith(i + 1, passwords[i], 10);
      }
    });

    it('should handle password validation timing attacks consistently', async () => {
      // Arrange
      const plainPassword = 'TestPassword123!';
      
      // Test with existing user
      userServiceClient.findByEmail.mockResolvedValueOnce(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(false as never);
      
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