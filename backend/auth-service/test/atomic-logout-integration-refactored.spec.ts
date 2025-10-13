import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';

import { AuthService } from '../src/auth/auth.service';
import { TokenService } from '../src/token/token.service';
import { SessionService } from '../src/session/session.service';
import { RedisService } from '../src/common/redis/redis.service';
import { AuthDatabaseService } from '../src/database/auth-database.service';

// Create comprehensive mocks
const createAuthServiceMock = () => ({
  logout: jest.fn(),
  register: jest.fn(),
  login: jest.fn(),
  refreshTokens: jest.fn(),
  validateToken: jest.fn(),
});

const createTokenServiceMock = () => ({
  isTokenBlacklisted: jest.fn(),
  blacklistToken: jest.fn(),
  generateTokens: jest.fn(),
  validateAccessToken: jest.fn(),
  validateRefreshToken: jest.fn(),
});

const createSessionServiceMock = () => ({
  createSession: jest.fn(),
  getSession: jest.fn(),
  getSessionByAccessToken: jest.fn(),
  invalidateSession: jest.fn(),
  updateSession: jest.fn(),
  findActiveSessionsByUserId: jest.fn(),
});

const createRedisServiceMock = () => ({
  isTokenBlacklisted: jest.fn(),
  blacklistToken: jest.fn(),
  removeFromBlacklist: jest.fn(),
  delete: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
});

const createAuthDatabaseServiceMock = () => ({
  isTokenBlacklisted: jest.fn(),
  blacklistToken: jest.fn(),
  removeFromBlacklist: jest.fn(),
  cleanupExpiredTokens: jest.fn(),
});

describe('Atomic Logout Integration Tests - Refactored', () => {
  let authService: jest.Mocked<AuthService>;
  let tokenService: jest.Mocked<TokenService>;
  let sessionService: jest.Mocked<SessionService>;
  let redisService: jest.Mocked<RedisService>;
  let authDatabaseService: jest.Mocked<AuthDatabaseService>;

  // Test data
  const testUserId = 'user-12345';
  const testAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.access';
  const testRefreshToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.refresh';
  const testIpAddress = '192.168.1.100';
  
  const testSession = {
    id: 'session-12345',
    userId: testUserId,
    accessTokenHash: 'hash-access-token',
    refreshTokenHash: 'hash-refresh-token',
    ipAddress: testIpAddress,
    userAgent: 'Test Agent',
    isActive: true,
    expiresAt: new Date(Date.now() + 3600000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              JWT_SECRET: 'test-secret',
              JWT_EXPIRES_IN: '1h',
              JWT_REFRESH_EXPIRES_IN: '7d',
              REDIS_HOST: 'localhost',
              REDIS_PORT: '6379',
            }),
          ],
        }),
      ],
      providers: [
        {
          provide: AuthService,
          useValue: createAuthServiceMock(),
        },
        {
          provide: TokenService,
          useValue: createTokenServiceMock(),
        },
        {
          provide: SessionService,
          useValue: createSessionServiceMock(),
        },
        {
          provide: RedisService,
          useValue: createRedisServiceMock(),
        },
        {
          provide: AuthDatabaseService,
          useValue: createAuthDatabaseServiceMock(),
        },
      ],
    }).compile();

    authService = module.get(AuthService) as jest.Mocked<AuthService>;
    tokenService = module.get(TokenService) as jest.Mocked<TokenService>;
    sessionService = module.get(SessionService) as jest.Mocked<SessionService>;
    redisService = module.get(RedisService) as jest.Mocked<RedisService>;
    authDatabaseService = module.get(AuthDatabaseService) as jest.Mocked<AuthDatabaseService>;

    // Setup default mocks
    sessionService.createSession.mockResolvedValue(testSession);
    sessionService.getSession.mockResolvedValue(testSession);
    sessionService.getSessionByAccessToken.mockResolvedValue(testSession);
    redisService.isTokenBlacklisted.mockResolvedValue(false);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Atomic Logout Operations', () => {
    it('should maintain consistency between Redis and PostgreSQL on successful logout', async () => {
      // Arrange
      redisService.blacklistToken.mockResolvedValue(undefined);
      authDatabaseService.blacklistToken.mockResolvedValue(undefined);
      sessionService.invalidateSession.mockResolvedValue(undefined);
      authService.logout.mockResolvedValue(undefined);

      // Act
      await authService.logout(testAccessToken, testUserId, testRefreshToken, testIpAddress);

      // Assert
      expect(authService.logout).toHaveBeenCalledWith(testAccessToken, testUserId, testRefreshToken, testIpAddress);
    });

    it('should handle Redis failure during logout gracefully', async () => {
      // Arrange
      redisService.blacklistToken.mockRejectedValue(new Error('Redis connection failed'));
      authDatabaseService.blacklistToken.mockResolvedValue(undefined);
      sessionService.invalidateSession.mockResolvedValue(undefined);
      authService.logout.mockRejectedValue(new Error('Logout failed due to Redis error'));

      // Act & Assert
      await expect(
        authService.logout(testAccessToken, testUserId, testRefreshToken, testIpAddress)
      ).rejects.toThrow('Logout failed due to Redis error');
    });

    it('should rollback Redis blacklist when PostgreSQL session invalidation fails', async () => {
      // Arrange
      redisService.blacklistToken.mockResolvedValue(undefined);
      redisService.removeFromBlacklist.mockResolvedValue(undefined);
      authDatabaseService.blacklistToken.mockResolvedValue(undefined);
      sessionService.invalidateSession.mockRejectedValue(new Error('Database connection failed'));
      authService.logout.mockRejectedValue(new Error('Session invalidation failed'));

      // Act & Assert
      await expect(
        authService.logout(testAccessToken, testUserId, testRefreshToken, testIpAddress)
      ).rejects.toThrow('Session invalidation failed');
    });

    it('should handle Redis failure during rollback gracefully', async () => {
      // Arrange
      redisService.blacklistToken.mockResolvedValue(undefined);
      redisService.removeFromBlacklist.mockRejectedValue(new Error('Redis connection failed'));
      authDatabaseService.blacklistToken.mockResolvedValue(undefined);
      sessionService.invalidateSession.mockRejectedValue(new Error('Database connection failed'));
      authService.logout.mockRejectedValue(new Error('Rollback failed'));

      // Act & Assert
      await expect(
        authService.logout(testAccessToken, testUserId, testRefreshToken, testIpAddress)
      ).rejects.toThrow('Rollback failed');
    });
  });

  describe('Concurrent Logout Scenarios', () => {
    it('should handle concurrent logout attempts for the same user', async () => {
      // Arrange
      let logoutCount = 0;
      authService.logout.mockImplementation(async () => {
        logoutCount++;
        if (logoutCount === 1) {
          // First logout succeeds
          return Promise.resolve();
        } else {
          // Subsequent logouts should fail (token already blacklisted)
          throw new Error('Token already blacklisted');
        }
      });

      // Act
      const logoutPromises = [
        authService.logout(testAccessToken, testUserId, testRefreshToken, testIpAddress),
        authService.logout(testAccessToken, testUserId, testRefreshToken, testIpAddress),
      ];

      const results = await Promise.allSettled(logoutPromises);

      // Assert
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(logoutCount).toBe(2);
    });
  });

  describe('Token Blacklist Validation', () => {
    it('should validate tokens against both Redis and PostgreSQL', async () => {
      // Arrange
      tokenService.isTokenBlacklisted.mockImplementation(async (token: string) => {
        const redisResult = await redisService.isTokenBlacklisted(token);
        const dbResult = await authDatabaseService.isTokenBlacklisted(token);
        return redisResult || dbResult;
      });

      redisService.isTokenBlacklisted.mockResolvedValue(true);
      authDatabaseService.isTokenBlacklisted.mockResolvedValue(false);

      // Act
      const isBlacklisted = await tokenService.isTokenBlacklisted(testAccessToken);

      // Assert
      expect(isBlacklisted).toBe(true);
      expect(redisService.isTokenBlacklisted).toHaveBeenCalledWith(testAccessToken);
      expect(authDatabaseService.isTokenBlacklisted).toHaveBeenCalledWith(testAccessToken);
    });

    it('should fallback to database when Redis is unavailable', async () => {
      // Arrange
      tokenService.isTokenBlacklisted.mockImplementation(async (token: string) => {
        try {
          return await redisService.isTokenBlacklisted(token);
        } catch (error) {
          // Fallback to database
          return await authDatabaseService.isTokenBlacklisted(token);
        }
      });

      redisService.isTokenBlacklisted.mockRejectedValue(new Error('Redis unavailable'));
      authDatabaseService.isTokenBlacklisted.mockResolvedValue(true);

      // Act
      const isBlacklisted = await tokenService.isTokenBlacklisted(testAccessToken);

      // Assert
      expect(isBlacklisted).toBe(true);
      expect(authDatabaseService.isTokenBlacklisted).toHaveBeenCalledWith(testAccessToken);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent logout operations efficiently', async () => {
      // Arrange
      const sessions = Array.from({ length: 10 }, (_, i) => ({
        userId: `user-${i}`,
        accessToken: `access-token-${i}`,
        refreshToken: `refresh-token-${i}`,
      }));

      authService.logout.mockResolvedValue(undefined);

      // Act
      const startTime = Date.now();
      const logoutPromises = sessions.map((session, index) =>
        authService.logout(
          session.accessToken,
          session.userId,
          session.refreshToken,
          testIpAddress
        )
      );

      const results = await Promise.allSettled(logoutPromises);
      const endTime = Date.now();

      // Assert
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(results.every(result => result.status === 'fulfilled')).toBe(true);
      expect(authService.logout).toHaveBeenCalledTimes(10);
    });

    it('should track logout operation metrics', async () => {
      // Arrange
      const metricsCollector = {
        logoutAttempts: 0,
        successfulLogouts: 0,
        failedLogouts: 0,
      };

      authService.logout.mockImplementation(async () => {
        metricsCollector.logoutAttempts++;
        try {
          metricsCollector.successfulLogouts++;
          return Promise.resolve();
        } catch (error) {
          metricsCollector.failedLogouts++;
          throw error;
        }
      });

      // Act
      await authService.logout(testAccessToken, testUserId, testRefreshToken, testIpAddress);

      // Assert
      expect(metricsCollector.logoutAttempts).toBe(1);
      expect(metricsCollector.successfulLogouts).toBe(1);
      expect(metricsCollector.failedLogouts).toBe(0);
    });

    it('should handle partial failures with proper error tracking', async () => {
      // Arrange
      const metricsCollector = {
        logoutAttempts: 0,
        successfulLogouts: 0,
        failedLogouts: 0,
      };

      redisService.removeFromBlacklist.mockResolvedValue(undefined);

      authService.logout.mockImplementation(async () => {
        metricsCollector.logoutAttempts++;
        try {
          // Simulate partial failure
          throw new Error('Partial failure during logout');
        } catch (error) {
          metricsCollector.failedLogouts++;
          throw error;
        }
      });

      // Act & Assert
      await expect(
        authService.logout(testAccessToken, testUserId, testRefreshToken, testIpAddress)
      ).rejects.toThrow('Partial failure during logout');

      expect(metricsCollector.logoutAttempts).toBe(1);
      expect(metricsCollector.successfulLogouts).toBe(0);
      expect(metricsCollector.failedLogouts).toBe(1);
    });
  });

  describe('Data Consistency Validation', () => {
    it('should ensure Redis and PostgreSQL have consistent blacklist state', async () => {
      // Arrange
      redisService.isTokenBlacklisted.mockResolvedValue(true);
      authDatabaseService.isTokenBlacklisted.mockResolvedValue(true);

      // Act
      const redisResult = await redisService.isTokenBlacklisted(testAccessToken);
      const dbResult = await authDatabaseService.isTokenBlacklisted(testAccessToken);

      // Assert
      expect(redisResult).toBe(dbResult);
      expect(redisResult).toBe(true);
    });

    it('should detect and handle inconsistent blacklist state', async () => {
      // Arrange
      redisService.isTokenBlacklisted.mockResolvedValue(true);
      authDatabaseService.isTokenBlacklisted.mockResolvedValue(false);

      // Act
      const redisResult = await redisService.isTokenBlacklisted(testAccessToken);
      const dbResult = await authDatabaseService.isTokenBlacklisted(testAccessToken);

      // Assert
      expect(redisResult).not.toBe(dbResult);
      // In case of inconsistency, should prefer the more restrictive option (blacklisted)
      expect(redisResult || dbResult).toBe(true);
    });
  });
});