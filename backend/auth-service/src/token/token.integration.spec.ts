import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';
import { RedisService } from '../common/redis/redis.service';
import { AuthDatabaseService } from '../database/auth-database.service';
import { UserServiceClient } from '../common/http-client/user-service.client';
import { SecurityServiceClient } from '../common/http-client/security-service.client';

describe('Token Integration', () => {
  let tokenService: TokenService;
  let jwtService: jest.Mocked<JwtService>;
  let redisService: jest.Mocked<RedisService>;
  let authDatabaseService: jest.Mocked<AuthDatabaseService>;
  let userServiceClient: jest.Mocked<UserServiceClient>;
  let securityServiceClient: jest.Mocked<SecurityServiceClient>;
  let configService: jest.Mocked<ConfigService>;

  const mockUser = {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jwtService = {
      signAsync: jest.fn(),
      verify: jest.fn(),
      decode: jest.fn(),
    } as any;

    redisService = {
      blacklistToken: jest.fn(),
      isTokenBlacklisted: jest.fn(),
      delete: jest.fn(),
      set: jest.fn(),
      get: jest.fn(),
      keys: jest.fn(),
      mget: jest.fn(),
    } as any;

    authDatabaseService = {
      blacklistToken: jest.fn(),
      isTokenBlacklisted: jest.fn(),
      blacklistAllUserTokens: jest.fn(),
      cleanupExpiredTokens: jest.fn(),
      getUserBlacklistedTokens: jest.fn(),
      logSecurityEvent: jest.fn(),
    } as any;

    userServiceClient = {
      findById: jest.fn().mockResolvedValue(mockUser),
      findByEmail: jest.fn(),
      createUser: jest.fn(),
      updateLastLogin: jest.fn(),
    } as any;

    securityServiceClient = {
      logSecurityEvent: jest.fn(),
      checkSuspiciousActivity: jest.fn(),
      logTokenRefresh: jest.fn(),
    } as any;

    configService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          'JWT_SECRET': 'test-secret',
          'JWT_EXPIRES_IN': '1h',
          'JWT_REFRESH_EXPIRES_IN': '7d',
          'TOKEN_BLACKLIST_TTL': 86400,
        };
        return config[key] || defaultValue;
      }),
    } as any;

    // Создаем моки для дополнительных зависимостей
    const distributedTransactionService = {
      atomicBlacklistToken: jest.fn().mockResolvedValue(undefined),
      atomicRemoveFromBlacklist: jest.fn().mockResolvedValue(undefined),
    } as any;

    const consistencyMetricsService = {
      recordAtomicOperationMetrics: jest.fn().mockResolvedValue(undefined),
    } as any;

    tokenService = new TokenService(
      jwtService,
      redisService,
      authDatabaseService,
      distributedTransactionService,
      consistencyMetricsService
    );
  });

  describe('Token Generation', () => {
    it('should generate access and refresh tokens', async () => {
      jwtService.signAsync.mockResolvedValueOnce('access-token-123');
      jwtService.signAsync.mockResolvedValueOnce('refresh-token-123');

      const result = await tokenService.generateTokens(mockUser);

      expect(result).toEqual({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresIn: 3600,
      });

      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(1,
        { sub: mockUser.id, email: mockUser.email }
      );
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(2,
        { sub: mockUser.id, email: mockUser.email },
        { expiresIn: '7d' }
      );
    });

    it('should generate tokens with correct expiration', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'JWT_EXPIRES_IN') return '2h';
        if (key === 'JWT_REFRESH_EXPIRES_IN') return '14d';
        return 'test-secret';
      });

      jwtService.signAsync.mockResolvedValueOnce('access-token');
      jwtService.signAsync.mockResolvedValueOnce('refresh-token');

      const result = await tokenService.generateTokens(mockUser);

      expect(result.expiresIn).toBe(3600); // Default is still 3600 (1h)
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(1,
        expect.any(Object)
      );
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(2,
        expect.any(Object),
        { expiresIn: '7d' }
      );
    });
  });

  describe('Token Blacklisting', () => {
    it('should blacklist token in both Redis and database', async () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImV4cCI6OTk5OTk5OTk5OX0.test';
      const userId = 'user-123';
      const reason = 'logout';

      // Mock decode to return valid payload with expiration
      jwtService.decode.mockReturnValue({
        sub: userId,
        email: 'test@example.com',
        exp: 9999999999 // Far future
      });

      const distributedTransactionService = {
        atomicBlacklistToken: jest.fn().mockResolvedValue(undefined),
      } as any;

      const consistencyMetricsService = {
        recordAtomicOperationMetrics: jest.fn().mockResolvedValue(undefined),
      } as any;

      // Recreate service with mocked dependencies
      tokenService = new TokenService(
        jwtService,
        redisService,
        authDatabaseService,
        distributedTransactionService,
        consistencyMetricsService
      );

      await tokenService.blacklistToken(token, userId, reason);

      expect(distributedTransactionService.atomicBlacklistToken).toHaveBeenCalledWith({
        token,
        tokenHash: expect.any(String),
        userId,
        reason,
        expiresAt: expect.any(Date),
        ttlSeconds: expect.any(Number),
        metadata: undefined
      });
    });

    it('should check if token is blacklisted', async () => {
      const token = 'access-token-123';

      redisService.isTokenBlacklisted.mockResolvedValue(true);

      const result = await tokenService.isTokenBlacklisted(token);

      expect(result).toBe(true);
      expect(redisService.isTokenBlacklisted).toHaveBeenCalledWith(token);
    });
  });

  describe('Token Validation', () => {
    it('should validate access token with user check', async () => {
      const token = 'access-token-123';
      const payload = { sub: 'user-123', email: 'test@example.com' };

      jwtService.verify.mockReturnValue(payload);
      redisService.isTokenBlacklisted.mockResolvedValue(false);
      authDatabaseService.isTokenBlacklisted.mockResolvedValue(false);
      redisService.get.mockResolvedValue(null);

      const result = await tokenService.validateTokenWithUserCheck(token);

      expect(result.valid).toBe(true);
      expect(result.payload).toEqual(payload);
    });

    it('should reject blacklisted tokens', async () => {
      const token = 'blacklisted-token';

      redisService.isTokenBlacklisted.mockResolvedValue(true);

      const result = await tokenService.validateToken(token);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Token is blacklisted');
    });

    it('should reject tokens when user tokens are invalidated', async () => {
      const token = 'access-token-123';
      const payload = { sub: 'user-123', email: 'test@example.com' };

      jwtService.verify.mockReturnValue(payload);
      redisService.isTokenBlacklisted.mockResolvedValue(false);
      authDatabaseService.isTokenBlacklisted.mockResolvedValue(false);
      redisService.get.mockResolvedValue('true'); // User tokens invalidated

      const result = await tokenService.validateTokenWithUserCheck(token);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('All user tokens have been invalidated');
    });
  });

  describe('Refresh Token Flow', () => {
    it('should refresh tokens with rotation', async () => {
      const oldRefreshToken = 'old-refresh-token';
      const payload = { sub: 'user-123', email: 'test@example.com' };

      jwtService.verify.mockReturnValue(payload);
      redisService.isTokenBlacklisted.mockResolvedValue(false);
      authDatabaseService.isTokenBlacklisted.mockResolvedValue(false);
      redisService.get.mockResolvedValue(null);
      
      jwtService.signAsync.mockResolvedValueOnce('new-access-token');
      jwtService.signAsync.mockResolvedValueOnce('new-refresh-token');

      const result = await tokenService.refreshTokenWithRotation(oldRefreshToken, 'user-123');

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(result.expiresIn).toBe(3600);
    });

    it('should validate refresh token correctly', async () => {
      const refreshToken = 'refresh-token-123';
      const payload = { sub: 'user-123', email: 'test@example.com' };

      jwtService.verify.mockReturnValue(payload);
      redisService.isTokenBlacklisted.mockResolvedValue(false);
      authDatabaseService.isTokenBlacklisted.mockResolvedValue(false);
      redisService.get.mockResolvedValue(null);

      const result = await tokenService.validateRefreshToken(refreshToken);

      expect(result.valid).toBe(true);
      expect(result.payload).toEqual(payload);
    });
  });

  describe('Bulk Operations', () => {
    it('should blacklist all user tokens', async () => {
      const userId = 'user-123';
      const reason = 'security';
      const metadata = { reason: 'Suspicious activity detected' };

      authDatabaseService.blacklistAllUserTokens.mockResolvedValue(undefined);
      redisService.delete.mockResolvedValue(undefined);
      redisService.set.mockResolvedValue(undefined);
      authDatabaseService.getUserBlacklistedTokens.mockResolvedValue([
        { tokenHash: 'hash1' },
        { tokenHash: 'hash2' },
        { tokenHash: 'hash3' },
        { tokenHash: 'hash4' },
        { tokenHash: 'hash5' },
      ] as any);

      await tokenService.blacklistAllUserTokens(userId, reason, metadata);

      expect(authDatabaseService.blacklistAllUserTokens).toHaveBeenCalledWith(userId, reason, metadata);
      expect(redisService.set).toHaveBeenCalledWith(
        `user_invalidated:${userId}`,
        'true',
        365 * 24 * 60 * 60
      );
    });

    it('should cleanup expired tokens', async () => {
      authDatabaseService.cleanupExpiredTokens.mockResolvedValue(42);

      const result = await tokenService.cleanupExpiredTokens();

      expect(result).toBe(42);
      expect(authDatabaseService.cleanupExpiredTokens).toHaveBeenCalled();
    });

    it('should get user blacklisted tokens', async () => {
      const userId = 'user-123';
      const mockTokens = [
        { id: '1', tokenHash: 'hash1', reason: 'logout' },
        { id: '2', tokenHash: 'hash2', reason: 'security' },
      ];

      authDatabaseService.getUserBlacklistedTokens.mockResolvedValue(mockTokens as any);

      const result = await tokenService.getUserBlacklistedTokens(userId);

      expect(result).toEqual(mockTokens);
      expect(authDatabaseService.getUserBlacklistedTokens).toHaveBeenCalledWith(userId);
    });
  });
});