import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';
import { RedisService } from '../common/redis/redis.service';
import { AuthDatabaseService } from '../database/auth-database.service';
import { TokenBlacklist } from '../entities/token-blacklist.entity';

describe('TokenService', () => {
  let service: TokenService;
  let jwtService: JwtService;
  let redisService: RedisService;
  let authDatabaseService: AuthDatabaseService;

  const mockJwtService = {
    signAsync: jest.fn(),
    decode: jest.fn(),
    verify: jest.fn(),
  };

  const mockRedisService = {
    blacklistToken: jest.fn(),
    isTokenBlacklisted: jest.fn(),
    delete: jest.fn(),
    set: jest.fn(),
    get: jest.fn(),
  };

  const mockAuthDatabaseService = {
    blacklistToken: jest.fn(),
    isTokenBlacklisted: jest.fn(),
    blacklistAllUserTokens: jest.fn(),
    getUserBlacklistedTokens: jest.fn(),
    cleanupExpiredTokens: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: AuthDatabaseService,
          useValue: mockAuthDatabaseService,
        },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
    jwtService = module.get<JwtService>(JwtService);
    redisService = module.get<RedisService>(RedisService);
    authDatabaseService = module.get<AuthDatabaseService>(AuthDatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', async () => {
      const user = { id: 'user-123', email: 'test@example.com' };
      const mockAccessToken = 'access-token';
      const mockRefreshToken = 'refresh-token';

      mockJwtService.signAsync
        .mockResolvedValueOnce(mockAccessToken)
        .mockResolvedValueOnce(mockRefreshToken);

      const result = await service.generateTokens(user);

      expect(result).toEqual({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        expiresIn: 3600,
      });

      expect(mockJwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(mockJwtService.signAsync).toHaveBeenNthCalledWith(1, {
        sub: user.id,
        email: user.email,
      });
      expect(mockJwtService.signAsync).toHaveBeenNthCalledWith(2, {
        sub: user.id,
        email: user.email,
      }, { expiresIn: '7d' });
    });
  });

  describe('blacklistToken', () => {
    it('should blacklist token in both database and Redis', async () => {
      const token = 'valid-token';
      const userId = 'user-123';
      const reason = 'logout';
      const mockDecoded = {
        sub: userId,
        email: 'test@example.com',
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      };

      mockJwtService.decode.mockReturnValue(mockDecoded);
      mockAuthDatabaseService.blacklistToken.mockResolvedValue({} as TokenBlacklist);
      mockRedisService.blacklistToken.mockResolvedValue(undefined);

      await service.blacklistToken(token, userId, reason);

      expect(mockJwtService.decode).toHaveBeenCalledWith(token);
      expect(mockAuthDatabaseService.blacklistToken).toHaveBeenCalledWith(
        expect.any(String), // token hash
        userId,
        reason,
        expect.any(Date), // expiration date
        undefined
      );
      expect(mockRedisService.blacklistToken).toHaveBeenCalledWith(
        token,
        expect.any(Number) // TTL
      );
    });

    it('should not blacklist expired token', async () => {
      const token = 'expired-token';
      const userId = 'user-123';
      const mockDecoded = {
        sub: userId,
        email: 'test@example.com',
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago (expired)
      };

      mockJwtService.decode.mockReturnValue(mockDecoded);

      await service.blacklistToken(token, userId);

      expect(mockAuthDatabaseService.blacklistToken).not.toHaveBeenCalled();
      expect(mockRedisService.blacklistToken).not.toHaveBeenCalled();
    });

    it('should handle invalid token gracefully', async () => {
      const token = 'invalid-token';
      const userId = 'user-123';

      mockJwtService.decode.mockReturnValue(null);

      await service.blacklistToken(token, userId);

      expect(mockAuthDatabaseService.blacklistToken).not.toHaveBeenCalled();
      expect(mockRedisService.blacklistToken).not.toHaveBeenCalled();
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return true if token is blacklisted in Redis', async () => {
      const token = 'blacklisted-token';
      mockRedisService.isTokenBlacklisted.mockResolvedValue(true);

      const result = await service.isTokenBlacklisted(token);

      expect(result).toBe(true);
      expect(mockRedisService.isTokenBlacklisted).toHaveBeenCalledWith(token);
      expect(mockAuthDatabaseService.isTokenBlacklisted).not.toHaveBeenCalled();
    });

    it('should check database if Redis returns false', async () => {
      const token = 'token';
      mockRedisService.isTokenBlacklisted.mockResolvedValue(false);
      mockAuthDatabaseService.isTokenBlacklisted.mockResolvedValue(true);

      const result = await service.isTokenBlacklisted(token);

      expect(result).toBe(true);
      expect(mockRedisService.isTokenBlacklisted).toHaveBeenCalledWith(token);
      expect(mockAuthDatabaseService.isTokenBlacklisted).toHaveBeenCalledWith(
        expect.any(String) // token hash
      );
    });

    it('should return false if both Redis and database return false', async () => {
      const token = 'valid-token';
      mockRedisService.isTokenBlacklisted.mockResolvedValue(false);
      mockAuthDatabaseService.isTokenBlacklisted.mockResolvedValue(false);

      const result = await service.isTokenBlacklisted(token);

      expect(result).toBe(false);
    });

    it('should return false on error (fail open)', async () => {
      const token = 'token';
      mockRedisService.isTokenBlacklisted.mockRejectedValue(new Error('Redis error'));
      mockAuthDatabaseService.isTokenBlacklisted.mockRejectedValue(new Error('DB error'));

      const result = await service.isTokenBlacklisted(token);

      expect(result).toBe(false);
    });
  });

  describe('validateToken', () => {
    it('should return valid result for valid non-blacklisted token', async () => {
      const token = 'valid-token';
      const mockPayload = { sub: 'user-123', email: 'test@example.com' };

      mockJwtService.verify.mockReturnValue(mockPayload);
      mockRedisService.isTokenBlacklisted.mockResolvedValue(false);
      mockAuthDatabaseService.isTokenBlacklisted.mockResolvedValue(false);

      const result = await service.validateToken(token);

      expect(result).toEqual({
        valid: true,
        payload: mockPayload,
      });
    });

    it('should return invalid result for blacklisted token', async () => {
      const token = 'blacklisted-token';
      const mockPayload = { sub: 'user-123', email: 'test@example.com' };

      mockJwtService.verify.mockReturnValue(mockPayload);
      mockRedisService.isTokenBlacklisted.mockResolvedValue(true);

      const result = await service.validateToken(token);

      expect(result).toEqual({
        valid: false,
        reason: 'Token is blacklisted',
      });
    });

    it('should return invalid result for expired token', async () => {
      const token = 'expired-token';
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';

      mockJwtService.verify.mockImplementation(() => {
        throw error;
      });

      const result = await service.validateToken(token);

      expect(result).toEqual({
        valid: false,
        reason: 'Token expired',
      });
    });

    it('should return invalid result for invalid token signature', async () => {
      const token = 'invalid-token';
      const error = new Error('Invalid token');
      error.name = 'JsonWebTokenError';

      mockJwtService.verify.mockImplementation(() => {
        throw error;
      });

      const result = await service.validateToken(token);

      expect(result).toEqual({
        valid: false,
        reason: 'Invalid token signature',
      });
    });
  });

  describe('blacklistAllUserTokens', () => {
    it('should blacklist all user tokens', async () => {
      const userId = 'user-123';
      const reason = 'security';
      const metadata = { reason: 'suspicious activity' };

      mockAuthDatabaseService.blacklistAllUserTokens.mockResolvedValue(undefined);
      mockRedisService.delete.mockResolvedValue(undefined);
      mockRedisService.set.mockResolvedValue(undefined);

      await service.blacklistAllUserTokens(userId, reason, metadata);

      expect(mockAuthDatabaseService.blacklistAllUserTokens).toHaveBeenCalledWith(
        userId,
        reason,
        metadata
      );
      expect(mockRedisService.delete).toHaveBeenCalledWith(`user_tokens:${userId}`);
      expect(mockRedisService.set).toHaveBeenCalledWith(
        `user_invalidated:${userId}`,
        'true',
        365 * 24 * 60 * 60 // 1 year
      );
    });
  });

  describe('validateTokenWithUserCheck', () => {
    it('should return invalid if all user tokens are invalidated', async () => {
      const token = 'valid-token';
      const mockPayload = { sub: 'user-123', email: 'test@example.com' };

      mockJwtService.verify.mockReturnValue(mockPayload);
      mockRedisService.isTokenBlacklisted.mockResolvedValue(false);
      mockAuthDatabaseService.isTokenBlacklisted.mockResolvedValue(false);
      mockRedisService.get.mockResolvedValue('true'); // User tokens invalidated

      const result = await service.validateTokenWithUserCheck(token);

      expect(result).toEqual({
        valid: false,
        reason: 'All user tokens have been invalidated',
      });
    });

    it('should return valid if user tokens are not invalidated', async () => {
      const token = 'valid-token';
      const mockPayload = { sub: 'user-123', email: 'test@example.com' };

      mockJwtService.verify.mockReturnValue(mockPayload);
      mockRedisService.isTokenBlacklisted.mockResolvedValue(false);
      mockAuthDatabaseService.isTokenBlacklisted.mockResolvedValue(false);
      mockRedisService.get.mockResolvedValue(null); // User tokens not invalidated

      const result = await service.validateTokenWithUserCheck(token);

      expect(result).toEqual({
        valid: true,
        payload: mockPayload,
      });
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should cleanup expired tokens and return count', async () => {
      const deletedCount = 5;
      mockAuthDatabaseService.cleanupExpiredTokens.mockResolvedValue(deletedCount);

      const result = await service.cleanupExpiredTokens();

      expect(result).toBe(deletedCount);
      expect(mockAuthDatabaseService.cleanupExpiredTokens).toHaveBeenCalled();
    });

    it('should return 0 on error', async () => {
      mockAuthDatabaseService.cleanupExpiredTokens.mockRejectedValue(new Error('DB error'));

      const result = await service.cleanupExpiredTokens();

      expect(result).toBe(0);
    });
  });

  describe('getUserBlacklistedTokens', () => {
    it('should return user blacklisted tokens', async () => {
      const userId = 'user-123';
      const mockTokens = [
        { id: '1', tokenHash: 'hash1', userId, reason: 'logout' },
        { id: '2', tokenHash: 'hash2', userId, reason: 'security' },
      ] as TokenBlacklist[];

      mockAuthDatabaseService.getUserBlacklistedTokens.mockResolvedValue(mockTokens);

      const result = await service.getUserBlacklistedTokens(userId);

      expect(result).toEqual(mockTokens);
      expect(mockAuthDatabaseService.getUserBlacklistedTokens).toHaveBeenCalledWith(userId);
    });

    it('should return empty array on error', async () => {
      const userId = 'user-123';
      mockAuthDatabaseService.getUserBlacklistedTokens.mockRejectedValue(new Error('DB error'));

      const result = await service.getUserBlacklistedTokens(userId);

      expect(result).toEqual([]);
    });
  });

  describe('decodeToken', () => {
    it('should decode token successfully', () => {
      const token = 'valid-token';
      const mockPayload = { sub: 'user-123', email: 'test@example.com' };

      mockJwtService.decode.mockReturnValue(mockPayload);

      const result = service.decodeToken(token);

      expect(result).toEqual(mockPayload);
      expect(mockJwtService.decode).toHaveBeenCalledWith(token);
    });

    it('should return null on decode error', () => {
      const token = 'invalid-token';
      mockJwtService.decode.mockImplementation(() => {
        throw new Error('Decode error');
      });

      const result = service.decodeToken(token);

      expect(result).toBeNull();
    });
  });
});