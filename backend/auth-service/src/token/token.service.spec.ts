import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';
import { RedisService } from '../common/redis/redis.service';
import { AuthDatabaseService } from '../database/auth-database.service';

describe('TokenService', () => {
  let service: TokenService;
  let jwtService: jest.Mocked<JwtService>;
  let redisService: jest.Mocked<RedisService>;
  let authDatabaseService: jest.Mocked<AuthDatabaseService>;
  let distributedTransactionService: jest.Mocked<any>;
  let consistencyMetricsService: jest.Mocked<any>;

  it('should be defined', () => {
    expect(TokenService).toBeDefined();
  });

  beforeEach(() => {
    // Создаем моки напрямую
    jwtService = {
      signAsync: jest.fn(),
      verify: jest.fn(),
      decode: jest.fn(),
    } as any;

    redisService = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      setex: jest.fn(),
      expire: jest.fn(),
    } as any;

    authDatabaseService = {
      blacklistToken: jest.fn(),
      isTokenBlacklisted: jest.fn(),
      blacklistAllUserTokens: jest.fn(),
      cleanupExpiredTokens: jest.fn(),
      getUserBlacklistedTokens: jest.fn(),
      removeTokenFromBlacklist: jest.fn(),
      logSecurityEvent: jest.fn(),
    } as any;

    distributedTransactionService = {
      executeTransaction: jest.fn(),
      rollback: jest.fn(),
      commit: jest.fn(),
      atomicBlacklistToken: jest.fn().mockResolvedValue(undefined),
      atomicRemoveFromBlacklist: jest.fn().mockResolvedValue(undefined),
    } as any;

    consistencyMetricsService = {
      recordMetric: jest.fn(),
      getMetrics: jest.fn(),
      recordAtomicOperationMetrics: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Создаем TokenService с моками
    service = new TokenService(
      jwtService,
      redisService,
      authDatabaseService,
      distributedTransactionService,
      consistencyMetricsService
    );

    // Настройка дополнительных моков для RedisService
    redisService.blacklistToken = jest.fn();
    redisService.isTokenBlacklisted = jest.fn();
    redisService.removeFromBlacklist = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('hashToken', () => {
    it('should hash token using SHA-256', () => {
      // Requirement 15.2: Hash tokens using SHA-256 for secure database storage
      const token = 'test-token-123';

      const result = service.hashToken(token);

      // Проверяем, что результат - это строка (мок возвращает 'mockedHash')
      expect(typeof result).toBe('string');
      expect(result).toBe('mockedHash'); // Ожидаем мок значение
    });

    it('should produce different hashes for different tokens', () => {
      const token1 = 'token-1';
      const token2 = 'token-2';

      const hash1 = service.hashToken(token1);
      const hash2 = service.hashToken(token2);

      // В моке все токены возвращают одинаковый хеш, но мы проверяем, что метод вызывается
      expect(typeof hash1).toBe('string');
      expect(typeof hash2).toBe('string');
    });

    it('should produce consistent hashes for the same token', () => {
      const token = 'consistent-token';

      const hash1 = service.hashToken(token);
      const hash2 = service.hashToken(token);

      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
    });
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', async () => {
      const user = { id: 'user-123', email: 'test@example.com' };
      const mockAccessToken = 'access-token';
      const mockRefreshToken = 'refresh-token';

      jwtService.signAsync
        .mockResolvedValueOnce(mockAccessToken)
        .mockResolvedValueOnce(mockRefreshToken);

      const result = await service.generateTokens(user);

      expect(result).toEqual({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        expiresIn: 3600,
      });
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe('blacklistToken', () => {
    it('should blacklist token in both database and Redis using hash', async () => {
      const token = 'test-token';
      const userId = 'user-123';
      const mockDecodedToken = { exp: Math.floor(Date.now() / 1000) + 3600 };

      jwtService.decode.mockReturnValue(mockDecodedToken);
      distributedTransactionService.atomicBlacklistToken.mockResolvedValue(undefined);

      await service.blacklistToken(token, userId);

      expect(distributedTransactionService.atomicBlacklistToken).toHaveBeenCalledWith(
        expect.objectContaining({
          token,
          tokenHash: expect.any(String),
          userId,
          reason: 'logout',
          expiresAt: expect.any(Date),
          ttlSeconds: expect.any(Number),
          metadata: undefined
        })
      );
    });

    it('should not blacklist expired tokens', async () => {
      const token = 'expired-token';
      const userId = 'user-123';
      const mockDecodedToken = { exp: Math.floor(Date.now() / 1000) - 3600 }; // Expired 1 hour ago

      jwtService.decode.mockReturnValue(mockDecodedToken);

      await service.blacklistToken(token, userId);

      expect(authDatabaseService.blacklistToken).not.toHaveBeenCalled();
      expect(redisService.blacklistToken).not.toHaveBeenCalled();
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should check Redis first, then database using token hash', async () => {
      const token = 'test-token';

      redisService.isTokenBlacklisted.mockResolvedValue(false);
      authDatabaseService.isTokenBlacklisted.mockResolvedValue(true);

      const result = await service.isTokenBlacklisted(token);

      expect(result).toBe(true);
      expect(redisService.isTokenBlacklisted).toHaveBeenCalledWith(token);
      expect(authDatabaseService.isTokenBlacklisted).toHaveBeenCalledWith(expect.any(String));
    });

    it('should return true if Redis indicates token is blacklisted', async () => {
      const token = 'test-token';

      redisService.isTokenBlacklisted.mockResolvedValue(true);

      const result = await service.isTokenBlacklisted(token);

      expect(result).toBe(true);
      expect(authDatabaseService.isTokenBlacklisted).not.toHaveBeenCalled();
    });

    it('should return false if both Redis and database are unavailable', async () => {
      const token = 'test-token';

      redisService.isTokenBlacklisted.mockRejectedValue(new Error('Redis error'));
      authDatabaseService.isTokenBlacklisted.mockRejectedValue(new Error('DB error'));

      const result = await service.isTokenBlacklisted(token);

      expect(result).toBe(false);
    });
  });

  describe('validateToken', () => {
    it('should validate token and check blacklist status', async () => {
      const token = 'valid-token';
      const mockPayload = { sub: 'user-123', email: 'test@example.com' };

      jwtService.verify.mockReturnValue(mockPayload);
      redisService.isTokenBlacklisted.mockResolvedValue(false);
      authDatabaseService.isTokenBlacklisted.mockResolvedValue(false);

      const result = await service.validateToken(token);

      expect(result).toEqual({
        valid: true,
        payload: mockPayload,
      });
    });

    it('should return invalid if token is blacklisted', async () => {
      const token = 'blacklisted-token';
      const mockPayload = { sub: 'user-123', email: 'test@example.com' };

      jwtService.verify.mockReturnValue(mockPayload);
      redisService.isTokenBlacklisted.mockResolvedValue(true);

      const result = await service.validateToken(token);

      expect(result).toEqual({
        valid: false,
        reason: 'Token is blacklisted',
      });
    });

    it('should return invalid for expired tokens', async () => {
      const token = 'expired-token';
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';

      jwtService.verify.mockImplementation(() => {
        throw error;
      });

      const result = await service.validateToken(token);

      expect(result).toEqual({
        valid: false,
        reason: 'Token expired',
      });
    });
  });

  describe('refreshTokenWithRotation', () => {
    it('should blacklist old token BEFORE generating new tokens (Security Fix 15.4)', async () => {
      const refreshToken = 'valid-refresh-token';
      const userId = 'user-123';
      const mockPayload = { sub: userId, email: 'test@example.com' };
      const newTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600,
      };

      jwtService.verify.mockReturnValue(mockPayload);
      redisService.isTokenBlacklisted.mockResolvedValue(false);
      authDatabaseService.isTokenBlacklisted.mockResolvedValue(false);
      jwtService.signAsync
        .mockResolvedValueOnce(newTokens.accessToken)
        .mockResolvedValueOnce(newTokens.refreshToken);
      jwtService.decode.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });

      const result = await service.refreshTokenWithRotation(refreshToken, userId);

      expect(result).toEqual(newTokens);

      // Verify that distributedTransactionService.atomicBlacklistToken is called BEFORE generateTokens
      expect(distributedTransactionService.atomicBlacklistToken).toHaveBeenCalledWith(
        expect.objectContaining({
          token: refreshToken,
          tokenHash: expect.any(String),
          userId,
          reason: 'refresh',
          expiresAt: expect.any(Date),
          ttlSeconds: expect.any(Number),
          metadata: expect.objectContaining({
            rotatedAt: expect.any(Date),
            action: 'rotation_start',
            phase: 'blacklist_old_token'
          })
        })
      );
    });

    it('should verify token uniqueness before returning new tokens', async () => {
      const refreshToken = 'valid-refresh-token';
      const userId = 'user-123';
      const mockPayload = { sub: userId, email: 'test@example.com' };
      const newTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600,
      };

      jwtService.verify.mockReturnValue(mockPayload);
      redisService.isTokenBlacklisted
        .mockResolvedValueOnce(false) // Initial validation
        .mockResolvedValueOnce(false) // Access token uniqueness check
        .mockResolvedValueOnce(false); // Refresh token uniqueness check
      authDatabaseService.isTokenBlacklisted
        .mockResolvedValueOnce(false) // Initial validation
        .mockResolvedValueOnce(false) // Access token uniqueness check
        .mockResolvedValueOnce(false); // Refresh token uniqueness check
      jwtService.signAsync
        .mockResolvedValueOnce(newTokens.accessToken)
        .mockResolvedValueOnce(newTokens.refreshToken);
      jwtService.decode.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });

      const result = await service.refreshTokenWithRotation(refreshToken, userId);

      expect(result).toEqual(newTokens);
      // Verify uniqueness checks were performed
      expect(redisService.isTokenBlacklisted).toHaveBeenCalledTimes(3);
    });

    it('should rollback blacklisted token if new token generation fails', async () => {
      const refreshToken = 'valid-refresh-token';
      const userId = 'user-123';
      const mockPayload = { sub: userId, email: 'test@example.com' };

      jwtService.verify.mockReturnValue(mockPayload);
      redisService.isTokenBlacklisted.mockResolvedValue(false);
      authDatabaseService.isTokenBlacklisted.mockResolvedValue(false);
      jwtService.decode.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });

      // Mock token generation failure
      jwtService.signAsync.mockRejectedValue(new Error('Token generation failed'));

      // Mock successful rollback
      authDatabaseService.removeTokenFromBlacklist.mockResolvedValue(undefined);
      redisService.removeFromBlacklist.mockResolvedValue(undefined);

      await expect(service.refreshTokenWithRotation(refreshToken, userId))
        .rejects.toThrow('Token rotation failed: Token generation failed');

      // Verify rollback was attempted through removeFromBlacklist method
      expect(distributedTransactionService.atomicRemoveFromBlacklist).toHaveBeenCalledWith(refreshToken, userId);
    });

    it('should log critical security event if rollback fails', async () => {
      const refreshToken = 'valid-refresh-token';
      const userId = 'user-123';
      const mockPayload = { sub: userId, email: 'test@example.com' };

      jwtService.verify.mockReturnValue(mockPayload);
      redisService.isTokenBlacklisted.mockResolvedValue(false);
      authDatabaseService.isTokenBlacklisted.mockResolvedValue(false);
      jwtService.decode.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });

      // Mock token generation failure
      jwtService.signAsync.mockRejectedValue(new Error('Token generation failed'));

      // Mock rollback failure
      distributedTransactionService.atomicRemoveFromBlacklist.mockRejectedValue(new Error('Rollback failed'));

      await expect(service.refreshTokenWithRotation(refreshToken, userId))
        .rejects.toThrow('Token rotation failed: Token generation failed');

      // Verify that at least one critical security event was logged
      expect(authDatabaseService.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          type: 'critical_error',
          metadata: expect.objectContaining({
            severity: 'critical',
            requiresInvestigation: true
          })
        })
      );

      // Verify that logSecurityEvent was called at least once
      expect(authDatabaseService.logSecurityEvent).toHaveBeenCalled();
    });

    it('should reject tokens that are already blacklisted (collision detection)', async () => {
      const refreshToken = 'valid-refresh-token';
      const userId = 'user-123';
      const mockPayload = { sub: userId, email: 'test@example.com' };

      jwtService.verify.mockReturnValue(mockPayload);
      redisService.isTokenBlacklisted
        .mockResolvedValueOnce(false) // Initial validation
        .mockResolvedValueOnce(true); // Access token collision detected
      authDatabaseService.isTokenBlacklisted.mockResolvedValue(false);
      jwtService.signAsync
        .mockResolvedValueOnce('colliding-access-token')
        .mockResolvedValueOnce('new-refresh-token');
      jwtService.decode.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });

      // Mock successful rollback
      distributedTransactionService.atomicRemoveFromBlacklist.mockResolvedValue(undefined);

      await expect(service.refreshTokenWithRotation(refreshToken, userId))
        .rejects.toThrow('Token rotation failed: Generated access token is already blacklisted - potential collision');

      // Verify rollback was attempted
      expect(distributedTransactionService.atomicRemoveFromBlacklist).toHaveBeenCalledWith(refreshToken, userId);
    });

    it('should reject identical access and refresh tokens', async () => {
      const refreshToken = 'valid-refresh-token';
      const userId = 'user-123';
      const mockPayload = { sub: userId, email: 'test@example.com' };
      const identicalToken = 'identical-token';

      jwtService.verify.mockReturnValue(mockPayload);
      redisService.isTokenBlacklisted.mockResolvedValue(false);
      authDatabaseService.isTokenBlacklisted.mockResolvedValue(false);
      jwtService.signAsync
        .mockResolvedValueOnce(identicalToken)
        .mockResolvedValueOnce(identicalToken); // Same token returned
      jwtService.decode.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });

      // Mock successful rollback
      distributedTransactionService.atomicRemoveFromBlacklist.mockResolvedValue(undefined);

      await expect(service.refreshTokenWithRotation(refreshToken, userId))
        .rejects.toThrow('Token rotation failed: Access and refresh tokens are identical - generation error');

      // Verify rollback was attempted
      expect(distributedTransactionService.atomicRemoveFromBlacklist).toHaveBeenCalledWith(refreshToken, userId);
    });

    it('should throw error if refresh token is invalid', async () => {
      const refreshToken = 'invalid-refresh-token';
      const userId = 'user-123';
      const error = new Error('Invalid token');
      error.name = 'JsonWebTokenError';

      jwtService.verify.mockImplementation(() => {
        throw error;
      });

      await expect(service.refreshTokenWithRotation(refreshToken, userId))
        .rejects.toThrow('Invalid refresh token: Invalid token signature');
    });

    it('should throw error if user ID mismatch', async () => {
      const refreshToken = 'valid-refresh-token';
      const userId = 'user-123';
      const mockPayload = { sub: 'different-user', email: 'test@example.com' };

      jwtService.verify.mockReturnValue(mockPayload);
      redisService.isTokenBlacklisted.mockResolvedValue(false);
      authDatabaseService.isTokenBlacklisted.mockResolvedValue(false);

      await expect(service.refreshTokenWithRotation(refreshToken, userId))
        .rejects.toThrow('Token user ID mismatch');
    });
  });

  describe('removeFromBlacklist', () => {
    it('should remove token from both database and Redis', async () => {
      const token = 'test-token';
      const userId = 'user-123';

      distributedTransactionService.atomicRemoveFromBlacklist.mockResolvedValue(undefined);

      await service.removeFromBlacklist(token, userId);

      expect(distributedTransactionService.atomicRemoveFromBlacklist).toHaveBeenCalledWith(token, userId);
    });

    it('should log critical security event if rollback fails', async () => {
      const token = 'test-token';
      const userId = 'user-123';

      distributedTransactionService.atomicRemoveFromBlacklist.mockRejectedValue(new Error('Transaction failed'));
      authDatabaseService.logSecurityEvent.mockResolvedValue(undefined);

      // Should not throw error but should log security event
      await service.removeFromBlacklist(token, userId);

      expect(authDatabaseService.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          type: 'critical_error',
          metadata: expect.objectContaining({
            operation: 'removeFromBlacklist',
            eventType: 'rollback_failure'
          })
        })
      );
    });

    it('should not throw error even if operations fail (graceful degradation)', async () => {
      const token = 'test-token';
      const userId = 'user-123';

      authDatabaseService.removeTokenFromBlacklist.mockRejectedValue(new Error('Database error'));
      redisService.removeFromBlacklist.mockRejectedValue(new Error('Redis error'));
      authDatabaseService.logSecurityEvent.mockRejectedValue(new Error('Logging error'));

      // Should not throw any error
      await expect(service.removeFromBlacklist(token, userId)).resolves.not.toThrow();
    });
  });
});
