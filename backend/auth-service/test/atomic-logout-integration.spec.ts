import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as request from 'supertest';
import { AuthService } from '../src/auth/auth.service';
import { TokenService } from '../src/token/token.service';
import { SessionService } from '../src/session/session.service';
import { RedisService } from '../src/common/redis/redis.service';
import { AuthDatabaseService } from '../src/database/auth-database.service';
import { Session, TokenBlacklist } from '../src/entities';
import { AppModule } from '../src/app.module';

describe('Atomic Logout Integration Tests', () => {
  let app: INestApplication;
  let authService: AuthService;
  let tokenService: TokenService;
  let sessionService: SessionService;
  let redisService: RedisService;
  let authDatabaseService: AuthDatabaseService;

  // Test data
  const testUser = {
    id: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
  };

  const testTokens = {
    accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjk5OTk5OTk5OTl9.test',
    refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjk5OTk5OTk5OTl9.refresh',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        AppModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    authService = moduleFixture.get<AuthService>(AuthService);
    tokenService = moduleFixture.get<TokenService>(TokenService);
    sessionService = moduleFixture.get<SessionService>(SessionService);
    redisService = moduleFixture.get<RedisService>(RedisService);
    authDatabaseService = moduleFixture.get<AuthDatabaseService>(AuthDatabaseService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await cleanupTestData();
  });

  afterEach(async () => {
    // Clean up test data after each test
    await cleanupTestData();
  });

  async function cleanupTestData() {
    try {
      // Clean Redis
      await redisService.delete(`blacklist:${testTokens.accessToken}`);
      await redisService.delete(`blacklist:${testTokens.refreshToken}`);
      
      // Clean Database - would need proper cleanup methods
      // This is a simplified version
    } catch (error) {
      console.warn('Cleanup failed:', error.message);
    }
  }

  async function createTestSession(): Promise<Session> {
    return await sessionService.createSession({
      userId: testUser.id,
      accessToken: testTokens.accessToken,
      refreshToken: testTokens.refreshToken,
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });
  }

  describe('Atomic Logout Consistency Tests', () => {
    it('should maintain consistency between Redis and PostgreSQL on successful logout', async () => {
      // Arrange
      const session = await createTestSession();
      
      // Verify initial state - tokens should not be blacklisted
      expect(await redisService.isTokenBlacklisted(testTokens.accessToken)).toBe(false);
      expect(await redisService.isTokenBlacklisted(testTokens.refreshToken)).toBe(false);
      
      const accessTokenHash = tokenService['createTokenHash'](testTokens.accessToken);
      const refreshTokenHash = tokenService['createTokenHash'](testTokens.refreshToken);
      expect(await authDatabaseService.isTokenBlacklisted(accessTokenHash)).toBe(false);
      expect(await authDatabaseService.isTokenBlacklisted(refreshTokenHash)).toBe(false);

      // Act
      await authService.logout(
        testTokens.accessToken,
        testUser.id,
        testTokens.refreshToken,
        '127.0.0.1'
      );

      // Assert - Both Redis and PostgreSQL should have blacklisted tokens
      expect(await redisService.isTokenBlacklisted(testTokens.accessToken)).toBe(true);
      expect(await redisService.isTokenBlacklisted(testTokens.refreshToken)).toBe(true);
      expect(await authDatabaseService.isTokenBlacklisted(accessTokenHash)).toBe(true);
      expect(await authDatabaseService.isTokenBlacklisted(refreshTokenHash)).toBe(true);

      // Session should be invalidated
      const updatedSession = await sessionService.getSession(session.id);
      expect(updatedSession?.isActive).toBe(false);
    });

    it('should rollback Redis blacklist when PostgreSQL session invalidation fails', async () => {
      // Arrange
      const session = await createTestSession();
      
      // Mock session service to fail on invalidation
      const originalInvalidateSession = sessionService.invalidateSession;
      sessionService.invalidateSession = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      try {
        // Act & Assert
        await expect(
          authService.logout(
            testTokens.accessToken,
            testUser.id,
            testTokens.refreshToken,
            '127.0.0.1'
          )
        ).rejects.toThrow();

        // Verify rollback - tokens should not be blacklisted after rollback
        expect(await redisService.isTokenBlacklisted(testTokens.accessToken)).toBe(false);
        expect(await redisService.isTokenBlacklisted(testTokens.refreshToken)).toBe(false);
        
        const accessTokenHash = tokenService['createTokenHash'](testTokens.accessToken);
        const refreshTokenHash = tokenService['createTokenHash'](testTokens.refreshToken);
        expect(await authDatabaseService.isTokenBlacklisted(accessTokenHash)).toBe(false);
        expect(await authDatabaseService.isTokenBlacklisted(refreshTokenHash)).toBe(false);

        // Session should still be active
        const updatedSession = await sessionService.getSession(session.id);
        expect(updatedSession?.isActive).toBe(true);

      } finally {
        // Restore original method
        sessionService.invalidateSession = originalInvalidateSession;
      }
    });

    it('should handle Redis failure during rollback gracefully', async () => {
      // Arrange
      const session = await createTestSession();
      
      // Mock services to simulate failures
      const originalInvalidateSession = sessionService.invalidateSession;
      const originalRemoveFromBlacklist = redisService.removeFromBlacklist;
      
      sessionService.invalidateSession = jest.fn().mockRejectedValue(new Error('Database connection failed'));
      redisService.removeFromBlacklist = jest.fn().mockRejectedValue(new Error('Redis connection failed'));

      try {
        // Act & Assert
        await expect(
          authService.logout(
            testTokens.accessToken,
            testUser.id,
            testTokens.refreshToken,
            '127.0.0.1'
          )
        ).rejects.toThrow();

        // Verify that despite rollback failure, the operation was attempted
        expect(redisService.removeFromBlacklist).toHaveBeenCalledTimes(2);

      } finally {
        // Restore original methods
        sessionService.invalidateSession = originalInvalidateSession;
        redisService.removeFromBlacklist = originalRemoveFromBlacklist;
      }
    });
  });

  describe('Concurrent Logout Scenarios', () => {
    it('should handle concurrent logout attempts without race conditions', async () => {
      // Arrange
      const session = await createTestSession();
      
      // Act - Simulate concurrent logout attempts
      const logoutPromises = Array(5).fill(null).map(() =>
        authService.logout(
          testTokens.accessToken,
          testUser.id,
          testTokens.refreshToken,
          '127.0.0.1'
        ).catch(error => error) // Catch errors to prevent Promise.all from failing
      );

      const results = await Promise.all(logoutPromises);

      // Assert - At least one should succeed, others may fail gracefully
      const successfulLogouts = results.filter(result => !(result instanceof Error));
      const failedLogouts = results.filter(result => result instanceof Error);

      expect(successfulLogouts.length).toBeGreaterThanOrEqual(1);
      
      // Verify final state is consistent
      expect(await redisService.isTokenBlacklisted(testTokens.accessToken)).toBe(true);
      expect(await redisService.isTokenBlacklisted(testTokens.refreshToken)).toBe(true);
      
      const updatedSession = await sessionService.getSession(session.id);
      expect(updatedSession?.isActive).toBe(false);
    });
  });

  describe('Token Validation After Logout', () => {
    it('should reject blacklisted tokens in both Redis and PostgreSQL', async () => {
      // Arrange
      const session = await createTestSession();
      
      // Verify tokens are initially valid
      expect(await tokenService.isTokenBlacklisted(testTokens.accessToken)).toBe(false);
      expect(await tokenService.isTokenBlacklisted(testTokens.refreshToken)).toBe(false);

      // Act
      await authService.logout(
        testTokens.accessToken,
        testUser.id,
        testTokens.refreshToken,
        '127.0.0.1'
      );

      // Assert - Tokens should be rejected
      expect(await tokenService.isTokenBlacklisted(testTokens.accessToken)).toBe(true);
      expect(await tokenService.isTokenBlacklisted(testTokens.refreshToken)).toBe(true);
    });

    it('should validate tokens correctly when Redis is down but PostgreSQL is available', async () => {
      // Arrange
      const session = await createTestSession();
      await authService.logout(
        testTokens.accessToken,
        testUser.id,
        testTokens.refreshToken,
        '127.0.0.1'
      );

      // Mock Redis to simulate failure
      const originalIsTokenBlacklisted = redisService.isTokenBlacklisted;
      redisService.isTokenBlacklisted = jest.fn().mockRejectedValue(new Error('Redis connection failed'));

      try {
        // Act & Assert - Should still detect blacklisted tokens via PostgreSQL
        expect(await tokenService.isTokenBlacklisted(testTokens.accessToken)).toBe(true);
        expect(await tokenService.isTokenBlacklisted(testTokens.refreshToken)).toBe(true);

      } finally {
        // Restore original method
        redisService.isTokenBlacklisted = originalIsTokenBlacklisted;
      }
    });
  });

  describe('Monitoring and Observability', () => {
    it('should emit proper events for successful atomic logout', async () => {
      // Arrange
      const session = await createTestSession();
      const eventSpy = jest.spyOn(authService['eventBusService'], 'publishUserLoggedOutEvent');

      // Act
      await authService.logout(
        testTokens.accessToken,
        testUser.id,
        testTokens.refreshToken,
        '127.0.0.1'
      );

      // Assert
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUser.id,
          sessionId: session.id,
          ipAddress: '127.0.0.1',
          reason: 'manual',
          timestamp: expect.any(Date),
        })
      );
    });

    it('should emit rollback events when compensation is triggered', async () => {
      // Arrange
      const session = await createTestSession();
      const eventSpy = jest.spyOn(authService['eventBusService'], 'publishSecurityEvent');
      
      // Mock session service to fail
      const originalInvalidateSession = sessionService.invalidateSession;
      sessionService.invalidateSession = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      try {
        // Act
        await expect(
          authService.logout(
            testTokens.accessToken,
            testUser.id,
            testTokens.refreshToken,
            '127.0.0.1'
          )
        ).rejects.toThrow();

        // Assert
        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'logout_rollback',
            userId: testUser.id,
            metadata: expect.objectContaining({
              rollbackReason: 'session_invalidation_failed',
              tokensRolledBack: 2,
              compensatingTransactionExecuted: true,
            }),
          })
        );

      } finally {
        sessionService.invalidateSession = originalInvalidateSession;
      }
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle multiple rapid logout operations efficiently', async () => {
      // Arrange
      const sessions = await Promise.all(
        Array(10).fill(null).map((_, index) => 
          sessionService.createSession({
            userId: `user-${index}`,
            accessToken: `token-${index}`,
            refreshToken: `refresh-${index}`,
            ipAddress: '127.0.0.1',
            userAgent: 'Test Agent',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          })
        )
      );

      const startTime = Date.now();

      // Act
      const logoutPromises = sessions.map((session, index) =>
        authService.logout(
          `token-${index}`,
          `user-${index}`,
          `refresh-${index}`,
          '127.0.0.1'
        )
      );

      await Promise.all(logoutPromises);
      const endTime = Date.now();

      // Assert
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify all operations completed successfully
      for (let i = 0; i < 10; i++) {
        expect(await tokenService.isTokenBlacklisted(`token-${i}`)).toBe(true);
        expect(await tokenService.isTokenBlacklisted(`refresh-${i}`)).toBe(true);
      }
    });
  });
});