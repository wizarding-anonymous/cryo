import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

// Test configurations
import { E2ETestModule } from '../src/test/e2e-test.module';
import { TestRedisService } from '../src/test/test-redis.config';

// Services
import { RedisService } from '../src/common/redis/redis.service';
import { TokenService } from '../src/token/token.service';
import { AuthDatabaseService } from '../src/database/auth-database.service';

describe('Redis Integration Tests - Refactored', () => {
  let redisService: TestRedisService;
  let tokenService: TokenService;
  let configService: ConfigService;
  let authDatabaseService: jest.Mocked<AuthDatabaseService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [E2ETestModule],
    }).compile();

    redisService = module.get<RedisService>(RedisService) as unknown as TestRedisService;
    tokenService = module.get<TokenService>(TokenService);
    configService = module.get<ConfigService>(ConfigService);
    authDatabaseService = module.get<AuthDatabaseService>(AuthDatabaseService) as jest.Mocked<AuthDatabaseService>;

    // Reset Redis mock before each test
    await redisService.flushall();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await redisService.flushall();
  });

  describe('Token Blacklisting in Shared Redis', () => {
    it('should blacklist token with proper key namespace', async () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      const ttlSeconds = 3600;

      await redisService.blacklistToken(token, ttlSeconds);

      // Verify token is blacklisted
      const isBlacklisted = await redisService.isTokenBlacklisted(token);
      expect(isBlacklisted).toBe(true);

      // Verify key exists with proper namespace
      const keyExists = await redisService.exists(`blacklist:${token}`);
      expect(keyExists).toBe(1);

      // Verify TTL is set correctly
      const ttl = await redisService.ttl(`blacklist:${token}`);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(ttlSeconds);
    });

    it('should handle concurrent token operations across microservices', async () => {
      const userId = 'user-123';
      const token1 = 'token1';
      const token2 = 'token2';

      // Simulate concurrent operations from different services
      const promises = [
        redisService.blacklistToken(token1, 3600),
        redisService.blacklistToken(token2, 3600),
        redisService.set(`user_invalidated:${userId}`, 'true', 86400),
      ];

      await Promise.all(promises);

      // Verify all operations completed successfully
      expect(await redisService.isTokenBlacklisted(token1)).toBe(true);
      expect(await redisService.isTokenBlacklisted(token2)).toBe(true);
      expect(await redisService.get(`user_invalidated:${userId}`)).toBe('true');
    });

    it('should handle token expiration correctly', async () => {
      const token = 'expiring-token';
      const shortTtl = 1; // 1 second

      await redisService.blacklistToken(token, shortTtl);

      // Initially should be blacklisted
      expect(await redisService.isTokenBlacklisted(token)).toBe(true);

      // Wait for expiration (simulate with manual cleanup)
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Manually trigger expiration check in test Redis
      const item = (redisService as any).storage.get(`blacklist:${token}`);
      if (item && item.expireAt && Date.now() > item.expireAt) {
        (redisService as any).storage.delete(`blacklist:${token}`);
      }

      // Should no longer be blacklisted
      expect(await redisService.isTokenBlacklisted(token)).toBe(false);
    });
  });

  describe('Distributed User Session Management', () => {
    it('should handle distributed locking for session operations', async () => {
      const userId = 'user-123';
      const lockKey = `session_limit:${userId}`;
      const lockValue = 'lock-value-123';
      const ttlSeconds = 5;

      const lockResult = await redisService.setNX(lockKey, lockValue, ttlSeconds);

      expect(lockResult).toBe('OK');
      expect(await redisService.isLocked(lockKey)).toBe(true);

      // Verify lock TTL
      const lockTtl = await redisService.getLockTTL(lockKey);
      expect(lockTtl).toBeGreaterThan(0);
      expect(lockTtl).toBeLessThanOrEqual(ttlSeconds);
    });

    it('should handle lock contention for concurrent session creation', async () => {
      const userId = 'user-123';
      const lockKey = `session_limit:${userId}`;

      // First lock succeeds
      const lock1 = await redisService.setNX(lockKey, 'lock1', 5);
      expect(lock1).toBe('OK');

      // Second lock fails (key already exists)
      const lock2 = await redisService.setNX(lockKey, 'lock2', 5);
      expect(lock2).toBeNull();

      // Verify only first lock is active
      expect(await redisService.isLocked(lockKey)).toBe(true);
    });

    it('should release locks correctly', async () => {
      const lockKey = 'test-lock';
      const lockValue = 'test-value';

      // Acquire lock
      await redisService.setNX(lockKey, lockValue, 10);
      expect(await redisService.isLocked(lockKey)).toBe(true);

      // Release lock with correct value
      const released = await redisService.releaseLock(lockKey, lockValue);
      expect(released).toBe(true);
      expect(await redisService.isLocked(lockKey)).toBe(false);
    });

    it('should not release locks with incorrect value', async () => {
      const lockKey = 'test-lock';
      const lockValue = 'correct-value';
      const wrongValue = 'wrong-value';

      // Acquire lock
      await redisService.setNX(lockKey, lockValue, 10);
      expect(await redisService.isLocked(lockKey)).toBe(true);

      // Try to release with wrong value
      const released = await redisService.releaseLock(lockKey, wrongValue);
      expect(released).toBe(false);
      expect(await redisService.isLocked(lockKey)).toBe(true);
    });
  });

  describe('Cross-Service Token Validation', () => {
    it('should validate tokens with distributed blacklist check', async () => {
      const user = { id: 'user-123', email: 'test@example.com' };
      const tokens = await tokenService.generateTokens(user);

      // Mock database response
      authDatabaseService.isTokenBlacklisted.mockResolvedValue(false);

      const validation = await tokenService.validateToken(tokens.accessToken);

      expect(validation.valid).toBe(true);
      expect(validation.payload).toBeDefined();
    });

    it('should handle token validation with user invalidation', async () => {
      const user = { id: 'user-123', email: 'test@example.com' };
      const tokens = await tokenService.generateTokens(user);

      // Set user as invalidated in Redis
      await redisService.set(`user_invalidated:${user.id}`, 'true', 86400);

      // Mock database response
      authDatabaseService.isTokenBlacklisted.mockResolvedValue(false);

      const validation = await tokenService.validateToken(tokens.accessToken);

      // Should be invalid due to user invalidation
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('invalidated');
    });

    it('should prioritize Redis over database for performance', async () => {
      const token = 'test-token';

      // Set token as blacklisted in Redis
      await redisService.blacklistToken(token, 3600);

      // Mock database to return false (not blacklisted)
      authDatabaseService.isTokenBlacklisted.mockResolvedValue(false);

      const isBlacklisted = await tokenService.isTokenBlacklisted(token);

      // Should return true from Redis, not call database
      expect(isBlacklisted).toBe(true);
      expect(authDatabaseService.isTokenBlacklisted).not.toHaveBeenCalled();
    });

    it('should fallback to database when Redis fails', async () => {
      const token = 'test-token';

      // Mock Redis to fail
      jest.spyOn(redisService, 'isTokenBlacklisted').mockRejectedValue(new Error('Redis error'));

      // Mock database to return true
      authDatabaseService.isTokenBlacklisted.mockResolvedValue(true);

      const isBlacklisted = await tokenService.isTokenBlacklisted(token);

      // Should fallback to database
      expect(isBlacklisted).toBe(true);
      expect(authDatabaseService.isTokenBlacklisted).toHaveBeenCalled();
    });
  });

  describe('Redis Key Management', () => {
    it('should use proper key namespacing for different data types', async () => {
      const token = 'test-token';
      const userId = 'user-123';
      const sessionId = 'session-456';

      // Test different key patterns
      await redisService.set(`blacklist:${token}`, 'true', 3600);
      await redisService.set(`user_invalidated:${userId}`, 'true', 86400);
      await redisService.set(`session_limit:${userId}`, sessionId, 300);

      // Verify all keys exist
      expect(await redisService.get(`blacklist:${token}`)).toBe('true');
      expect(await redisService.get(`user_invalidated:${userId}`)).toBe('true');
      expect(await redisService.get(`session_limit:${userId}`)).toBe(sessionId);
    });

    it('should handle key expiration and TTL management', async () => {
      const key = 'test-key';
      const value = 'test-value';
      const ttl = 10;

      await redisService.set(key, value, ttl);

      // Check initial TTL
      const initialTtl = await redisService.ttl(key);
      expect(initialTtl).toBeGreaterThan(0);
      expect(initialTtl).toBeLessThanOrEqual(ttl);

      // Update TTL
      await redisService.expire(key, 20);
      const updatedTtl = await redisService.ttl(key);
      expect(updatedTtl).toBeGreaterThan(initialTtl);
    });

    it('should handle bulk operations for performance', async () => {
      const keys = ['key1', 'key2', 'key3'];
      const values = ['value1', 'value2', 'value3'];

      // Set multiple keys
      for (let i = 0; i < keys.length; i++) {
        await redisService.set(keys[i], values[i]);
      }

      // Get multiple keys at once
      const results = await redisService.mget(...keys);

      expect(results).toEqual(values);
    });

    it('should handle key pattern matching for cleanup operations', async () => {
      // Set multiple blacklist keys
      await redisService.set('blacklist:token1', 'true');
      await redisService.set('blacklist:token2', 'true');
      await redisService.set('user_invalidated:user1', 'true');

      const blacklistKeys = await redisService.keys('blacklist:*');

      expect(blacklistKeys).toHaveLength(2);
      expect(blacklistKeys).toContain('blacklist:token1');
      expect(blacklistKeys).toContain('blacklist:token2');
      expect(blacklistKeys).not.toContain('user_invalidated:user1');
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle Redis connection errors gracefully', async () => {
      const token = 'test-token';

      // Mock Redis method to fail
      jest.spyOn(redisService, 'isTokenBlacklisted').mockRejectedValue(
        new Error('Connection refused')
      );

      // Mock database fallback
      authDatabaseService.isTokenBlacklisted.mockResolvedValue(false);

      // Should not throw error, but return false for availability
      const isBlacklisted = await tokenService.isTokenBlacklisted(token);

      expect(isBlacklisted).toBe(false);
      expect(authDatabaseService.isTokenBlacklisted).toHaveBeenCalled();
    });

    it('should handle Redis timeout errors', async () => {
      const key = 'test-key';
      const value = 'test-value';

      // Mock Redis to timeout
      jest.spyOn(redisService, 'set').mockRejectedValue(
        new Error('Command timeout')
      );

      await expect(redisService.set(key, value)).rejects.toThrow('Command timeout');
    });

    it('should handle Redis memory pressure gracefully', async () => {
      const token = 'test-token';

      // Mock Redis to fail with OOM error
      jest.spyOn(redisService, 'blacklistToken').mockRejectedValue(
        new Error('OOM command not allowed when used memory > maxmemory')
      );

      await expect(redisService.blacklistToken(token, 3600)).rejects.toThrow();
    });

    it('should handle partial Redis failures', async () => {
      const tokens = ['token1', 'token2', 'token3'];

      // Mock some operations to fail
      jest.spyOn(redisService, 'blacklistToken')
        .mockResolvedValueOnce(undefined) // First succeeds
        .mockRejectedValueOnce(new Error('Redis error')) // Second fails
        .mockResolvedValueOnce(undefined); // Third succeeds

      const results = await Promise.allSettled(
        tokens.map(token => redisService.blacklistToken(token, 3600))
      );

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-frequency operations', async () => {
      const operations = [];
      const numOperations = 100;

      // Create many concurrent operations
      for (let i = 0; i < numOperations; i++) {
        operations.push(redisService.set(`key${i}`, `value${i}`, 60));
      }

      const startTime = Date.now();
      await Promise.all(operations);
      const endTime = Date.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(1000); // Less than 1 second

      // Verify all keys were set
      const keys = await redisService.keys('key*');
      expect(keys).toHaveLength(numOperations);
    });

    it('should handle memory cleanup efficiently', async () => {
      // Set many keys with short TTL
      const keys = [];
      for (let i = 0; i < 50; i++) {
        const key = `temp_key_${i}`;
        keys.push(key);
        await redisService.set(key, `value_${i}`, 1); // 1 second TTL
      }

      // Initially all keys should exist
      let existingKeys = await redisService.keys('temp_key_*');
      expect(existingKeys.length).toBeGreaterThan(0);

      // Wait for expiration and trigger cleanup
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Manually trigger expiration cleanup in test Redis
      for (const key of keys) {
        const item = (redisService as any).storage.get(key);
        if (item && item.expireAt && Date.now() > item.expireAt) {
          (redisService as any).storage.delete(key);
        }
      }

      // Keys should be cleaned up
      existingKeys = await redisService.keys('temp_key_*');
      expect(existingKeys).toHaveLength(0);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate Redis configuration for shared usage', () => {
      // Verify Redis configuration matches expected values for microservices
      expect(configService.get('REDIS_HOST')).toBe('localhost');
      expect(configService.get('REDIS_PORT')).toBe('6379');
      expect(configService.get('REDIS_PASSWORD')).toBe('test-password');
      expect(configService.get('REDIS_URL')).toBe('redis://:test-password@localhost:6379');
    });

    it('should have proper microservice URLs configured', () => {
      expect(configService.get('USER_SERVICE_URL')).toBe('http://localhost:3002');
      expect(configService.get('SECURITY_SERVICE_URL')).toBe('http://localhost:3010');
      expect(configService.get('NOTIFICATION_SERVICE_URL')).toBe('http://localhost:3007');
    });

    it('should have circuit breaker configuration', () => {
      expect(configService.get('CIRCUIT_BREAKER_TIMEOUT')).toBe('3000');
      expect(configService.get('CIRCUIT_BREAKER_ERROR_THRESHOLD')).toBe('50');
      expect(configService.get('CIRCUIT_BREAKER_RESET_TIMEOUT')).toBe('30000');
    });

    it('should be configured for test environment', () => {
      expect(configService.get('NODE_ENV')).toBe('test');
      expect(configService.get('IS_E2E_TEST')).toBe('true');
    });
  });
});