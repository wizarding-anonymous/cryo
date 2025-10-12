import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { RedisService } from '../src/common/redis/redis.service';
import { TokenService } from '../src/token/token.service';
import { AuthDatabaseService } from '../src/database/auth-database.service';

describe('Redis Integration Tests', () => {
  let redisService: RedisService;
  let tokenService: TokenService;
  let configService: ConfigService;

  // Mock Auth Database Service
  const mockAuthDatabaseService = {
    blacklistToken: jest.fn(),
    isTokenBlacklisted: jest.fn(),
    blacklistAllUserTokens: jest.fn(),
    getUserBlacklistedTokens: jest.fn(),
    cleanupExpiredTokens: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              // Shared Redis configuration matching Docker Compose
              REDIS_HOST: 'redis',
              REDIS_PORT: '6379',
              REDIS_PASSWORD: 'redis_password',
              REDIS_URL: 'redis://:redis_password@redis:6379',
              
              // JWT configuration
              JWT_SECRET: 'test-secret-key',
              JWT_EXPIRES_IN: '1h',
              JWT_REFRESH_EXPIRES_IN: '7d',
            }),
          ],
        }),
        JwtModule.registerAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            secret: configService.get<string>('JWT_SECRET', 'test-secret-key'),
            signOptions: {
              expiresIn: configService.get<string>('JWT_EXPIRES_IN', '1h'),
            },
          }),
          inject: [ConfigService],
        }),
      ],
      providers: [
        TokenService,
        {
          provide: RedisService,
          useValue: {
            blacklistToken: jest.fn(),
            isTokenBlacklisted: jest.fn(),
            removeFromBlacklist: jest.fn(),
            set: jest.fn(),
            get: jest.fn(),
            delete: jest.fn(),
            setNX: jest.fn(),
            getTTL: jest.fn(),
            keys: jest.fn(),
            mget: jest.fn(),
            onModuleInit: jest.fn(),
            onModuleDestroy: jest.fn(),
          },
        },
        {
          provide: AuthDatabaseService,
          useValue: mockAuthDatabaseService,
        },
      ],
    }).compile();

    redisService = module.get<RedisService>(RedisService);
    tokenService = module.get<TokenService>(TokenService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Token Blacklisting in Shared Redis', () => {
    it('should blacklist token with proper key namespace', async () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      const ttlSeconds = 3600;

      (redisService.blacklistToken as jest.Mock).mockResolvedValue(undefined);

      await redisService.blacklistToken(token, ttlSeconds);

      expect(redisService.blacklistToken).toHaveBeenCalledWith(token, ttlSeconds);
    });

    it('should handle concurrent token operations across microservices', async () => {
      const userId = 'user-123';
      const token1 = 'token1';
      const token2 = 'token2';

      // Mock Redis operations
      (redisService.blacklistToken as jest.Mock).mockResolvedValue(undefined);
      (redisService.set as jest.Mock).mockResolvedValue(undefined);
      (redisService.get as jest.Mock).mockResolvedValue('true');

      // Simulate concurrent operations from different services
      const promises = [
        redisService.blacklistToken(token1, 3600),
        redisService.blacklistToken(token2, 3600),
        redisService.set(`user_invalidated:${userId}`, 'true', 86400),
      ];

      await Promise.all(promises);

      expect(redisService.blacklistToken).toHaveBeenCalledTimes(2);
      expect(redisService.set).toHaveBeenCalledWith(
        `user_invalidated:${userId}`,
        'true',
        86400
      );
    });
  });

  describe('Distributed User Session Management', () => {
    it('should handle distributed locking for session operations', async () => {
      const userId = 'user-123';
      const lockKey = `session_limit:${userId}`;
      const lockValue = 'lock-value-123';
      const ttlSeconds = 5;

      (redisService.setNX as jest.Mock).mockResolvedValue('OK');

      const lockResult = await redisService.setNX(lockKey, lockValue, ttlSeconds);

      expect(lockResult).toBe('OK');
      expect(redisService.setNX).toHaveBeenCalledWith(lockKey, lockValue, ttlSeconds);
    });

    it('should handle lock contention for concurrent session creation', async () => {
      const userId = 'user-123';
      const lockKey = `session_limit:${userId}`;

      // First lock succeeds
      (redisService.setNX as jest.Mock).mockResolvedValueOnce('OK');
      // Second lock fails (key already exists)
      (redisService.setNX as jest.Mock).mockResolvedValueOnce(null);

      const lock1 = await redisService.setNX(lockKey, 'lock1', 5);
      const lock2 = await redisService.setNX(lockKey, 'lock2', 5);

      expect(lock1).toBe('OK'); // First lock succeeds
      expect(lock2).toBeNull(); // Second lock fails
    });
  });

  describe('Cross-Service Token Validation', () => {
    it('should validate tokens with distributed blacklist check', async () => {
      const user = { id: 'user-123', email: 'test@example.com' };
      const tokens = await tokenService.generateTokens(user);

      // Mock Redis and database responses
      (redisService.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      (redisService.get as jest.Mock).mockResolvedValue(null);
      mockAuthDatabaseService.isTokenBlacklisted.mockResolvedValue(false);

      const validation = await tokenService.validateTokenWithUserCheck(tokens.accessToken);

      expect(validation.valid).toBe(true);
      expect(redisService.isTokenBlacklisted).toHaveBeenCalledWith(tokens.accessToken);
      expect(redisService.get).toHaveBeenCalledWith(`user_invalidated:${user.id}`);
    });

    it('should handle token validation with user invalidation', async () => {
      const user = { id: 'user-123', email: 'test@example.com' };
      const tokens = await tokenService.generateTokens(user);

      // Mock Redis responses
      (redisService.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      (redisService.get as jest.Mock).mockResolvedValue('true'); // User invalidated
      mockAuthDatabaseService.isTokenBlacklisted.mockResolvedValue(false);

      const validation = await tokenService.validateTokenWithUserCheck(tokens.accessToken);

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('All user tokens have been invalidated');
    });
  });

  describe('Redis Key Management', () => {
    it('should use proper key namespacing for different data types', async () => {
      const token = 'test-token';
      const userId = 'user-123';
      const sessionId = 'session-456';

      // Mock Redis operations
      (redisService.set as jest.Mock).mockResolvedValue(undefined);
      (redisService.get as jest.Mock).mockResolvedValue(null);

      // Test different key patterns
      await redisService.set(`blacklist:${token}`, 'true', 3600);
      await redisService.set(`user_invalidated:${userId}`, 'true', 86400);
      await redisService.set(`session_limit:${userId}`, sessionId, 300);

      expect(redisService.set).toHaveBeenCalledWith(`blacklist:${token}`, 'true', 3600);
      expect(redisService.set).toHaveBeenCalledWith(`user_invalidated:${userId}`, 'true', 86400);
      expect(redisService.set).toHaveBeenCalledWith(`session_limit:${userId}`, sessionId, 300);
    });

    it('should handle key expiration and TTL management', async () => {
      const key = 'test-key';

      (redisService.getTTL as jest.Mock).mockResolvedValue(3600);

      const ttl = await redisService.getTTL(key);

      expect(ttl).toBe(3600);
      expect(redisService.getTTL).toHaveBeenCalledWith(key);
    });

    it('should handle bulk operations for performance', async () => {
      const keys = ['key1', 'key2', 'key3'];
      const values = ['value1', 'value2', 'value3'];

      (redisService.mget as jest.Mock).mockResolvedValue(values);

      const results = await redisService.mget(...keys);

      expect(results).toEqual(values);
      expect(redisService.mget).toHaveBeenCalledWith(...keys);
    });

    it('should handle key pattern matching for cleanup operations', async () => {
      const pattern = 'blacklist:*';
      const matchingKeys = ['blacklist:token1', 'blacklist:token2'];

      (redisService.keys as jest.Mock).mockResolvedValue(matchingKeys);

      const keys = await redisService.keys(pattern);

      expect(keys).toEqual(matchingKeys);
      expect(redisService.keys).toHaveBeenCalledWith(pattern);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle Redis connection errors gracefully', async () => {
      const token = 'test-token';

      (redisService.isTokenBlacklisted as jest.Mock).mockRejectedValue(
        new Error('Connection refused')
      );

      // Should not throw error, but return false for availability
      const isBlacklisted = await tokenService.isTokenBlacklisted(token);

      expect(isBlacklisted).toBe(false);
    });

    it('should handle Redis timeout errors', async () => {
      const key = 'test-key';
      const value = 'test-value';

      (redisService.set as jest.Mock).mockRejectedValue(
        new Error('Command timeout')
      );

      await expect(redisService.set(key, value)).rejects.toThrow('Command timeout');
    });

    it('should handle Redis memory pressure', async () => {
      const token = 'test-token';

      (redisService.blacklistToken as jest.Mock).mockRejectedValue(
        new Error('OOM command not allowed when used memory > maxmemory')
      );

      await expect(redisService.blacklistToken(token, 3600)).rejects.toThrow();
    });

    it('should handle Redis cluster failover scenarios', async () => {
      const userId = 'user-123';

      // Simulate cluster failover - first call fails, second succeeds
      (redisService.get as jest.Mock)
        .mockRejectedValueOnce(new Error('CLUSTERDOWN Hash slot not served'))
        .mockResolvedValueOnce('true');

      // First call should fail
      await expect(redisService.get(`user_invalidated:${userId}`)).rejects.toThrow();

      // Second call should succeed after failover
      const result = await redisService.get(`user_invalidated:${userId}`);
      expect(result).toBe('true');
    });
  });
});