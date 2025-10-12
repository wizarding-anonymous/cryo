import { Logger } from '@nestjs/common';
import { DistributedTransactionService } from './distributed-transaction.service';
import { RedisService } from '../redis/redis.service';
import { AuthDatabaseService } from '../../database/auth-database.service';
import { ConsistencyMetricsService } from './consistency-metrics.service';

describe('DistributedTransactionService', () => {
  let service: DistributedTransactionService;
  let redisService: jest.Mocked<RedisService>;
  let authDatabaseService: jest.Mocked<AuthDatabaseService>;
  let consistencyMetricsService: jest.Mocked<ConsistencyMetricsService>;

  const mockTokenData = {
    token: 'test.jwt.token',
    tokenHash: 'hash123',
    userId: 'user123',
    reason: 'logout' as const,
    expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    ttlSeconds: 3600,
    metadata: { test: true }
  };

  beforeEach(() => {
    redisService = {
      isTokenBlacklisted: jest.fn(),
      setNX: jest.fn(),
      blacklistToken: jest.fn(),
      removeFromBlacklist: jest.fn(),
      delete: jest.fn(),
      keys: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      mget: jest.fn(),
      getTTL: jest.fn(),
    } as any;

    authDatabaseService = {
      isTokenBlacklisted: jest.fn(),
      blacklistToken: jest.fn(),
      removeTokenFromBlacklist: jest.fn(),
      getAllBlacklistedTokens: jest.fn(),
      logSecurityEvent: jest.fn(),
    } as any;

    consistencyMetricsService = {
      recordConsistencyMetrics: jest.fn(),
      recordRaceConditionMetrics: jest.fn(),
      recordAtomicOperationMetrics: jest.fn(),
      getMetricsSnapshot: jest.fn(),
      getPrometheusMetrics: jest.fn(),
      cleanupOldMetrics: jest.fn(),
    } as any;

    service = new DistributedTransactionService(
      redisService,
      authDatabaseService,
      consistencyMetricsService
    );

    // Suppress logs during testing
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('atomicBlacklistToken', () => {
    it('should successfully blacklist token with 2PC', async () => {
      // Setup mocks for successful operation
      redisService.isTokenBlacklisted.mockResolvedValue(false);
      authDatabaseService.isTokenBlacklisted.mockResolvedValue(false);
      redisService.setNX.mockResolvedValue('OK');
      authDatabaseService.blacklistToken.mockResolvedValue({} as any);
      redisService.blacklistToken.mockResolvedValue();
      redisService.delete.mockResolvedValue();

      await service.atomicBlacklistToken(mockTokenData);

      // Verify prepare phase
      expect(redisService.isTokenBlacklisted).toHaveBeenCalledWith(mockTokenData.token);
      expect(authDatabaseService.isTokenBlacklisted).toHaveBeenCalledWith(mockTokenData.tokenHash);
      expect(redisService.setNX).toHaveBeenCalledWith(
        expect.stringContaining('prepare_lock:blacklist:'),
        'preparing',
        30
      );

      // Verify commit phase
      expect(authDatabaseService.blacklistToken).toHaveBeenCalledWith(
        mockTokenData.tokenHash,
        mockTokenData.userId,
        mockTokenData.reason,
        mockTokenData.expiresAt,
        mockTokenData.metadata
      );
      expect(redisService.blacklistToken).toHaveBeenCalledWith(
        mockTokenData.token,
        mockTokenData.ttlSeconds
      );

      // Verify cleanup
      expect(redisService.delete).toHaveBeenCalledWith(
        expect.stringContaining('prepare_lock:blacklist:')
      );
    });

    it('should fail during prepare phase if token already blacklisted in Redis', async () => {
      redisService.isTokenBlacklisted.mockResolvedValue(true);

      await expect(service.atomicBlacklistToken(mockTokenData)).rejects.toThrow(
        'Prepare failed for operation blacklist_token: Token is already blacklisted in Redis'
      );

      // Should not proceed to commit phase
      expect(authDatabaseService.blacklistToken).not.toHaveBeenCalled();
      expect(redisService.blacklistToken).not.toHaveBeenCalled();
    });

    it('should fail during prepare phase if token already blacklisted in PostgreSQL', async () => {
      redisService.isTokenBlacklisted.mockResolvedValue(false);
      authDatabaseService.isTokenBlacklisted.mockResolvedValue(true);

      await expect(service.atomicBlacklistToken(mockTokenData)).rejects.toThrow(
        'Prepare failed for operation blacklist_token: Token is already blacklisted in PostgreSQL'
      );

      // Should not proceed to commit phase
      expect(authDatabaseService.blacklistToken).not.toHaveBeenCalled();
      expect(redisService.blacklistToken).not.toHaveBeenCalled();
    });

    it('should fail during prepare phase if cannot acquire prepare lock', async () => {
      redisService.isTokenBlacklisted.mockResolvedValue(false);
      authDatabaseService.isTokenBlacklisted.mockResolvedValue(false);
      redisService.setNX.mockResolvedValue(null); // Lock acquisition failed

      await expect(service.atomicBlacklistToken(mockTokenData)).rejects.toThrow(
        'Prepare failed for operation blacklist_token: Failed to acquire prepare lock in Redis'
      );

      // Should not proceed to commit phase
      expect(authDatabaseService.blacklistToken).not.toHaveBeenCalled();
      expect(redisService.blacklistToken).not.toHaveBeenCalled();
    });

    it('should handle commit phase failure and perform compensation', async () => {
      // Setup successful prepare phase
      redisService.isTokenBlacklisted.mockResolvedValue(false);
      authDatabaseService.isTokenBlacklisted.mockResolvedValue(false);
      redisService.setNX.mockResolvedValue('OK');

      // Setup commit phase failure
      authDatabaseService.blacklistToken.mockResolvedValue({} as any);
      redisService.blacklistToken.mockRejectedValue(new Error('Redis connection failed'));

      await expect(service.atomicBlacklistToken(mockTokenData)).rejects.toThrow();

      // Verify compensation was attempted
      expect(redisService.delete).toHaveBeenCalledWith(
        expect.stringContaining('prepare_lock:blacklist:')
      );
    });
  });

  describe('atomicRemoveFromBlacklist', () => {
    it('should successfully remove token from blacklist with 2PC', async () => {
      const token = 'test.jwt.token';
      const userId = 'user123';

      // Setup mocks for successful operation
      redisService.isTokenBlacklisted.mockResolvedValue(true);
      authDatabaseService.isTokenBlacklisted.mockResolvedValue(true);
      redisService.setNX.mockResolvedValue('OK');
      authDatabaseService.removeTokenFromBlacklist.mockResolvedValue();
      redisService.removeFromBlacklist.mockResolvedValue();
      redisService.delete.mockResolvedValue();

      await service.atomicRemoveFromBlacklist(token, userId);

      // Verify prepare phase
      expect(redisService.isTokenBlacklisted).toHaveBeenCalledWith(token);
      expect(authDatabaseService.isTokenBlacklisted).toHaveBeenCalledWith(
        expect.any(String) // token hash
      );
      expect(redisService.setNX).toHaveBeenCalledWith(
        expect.stringContaining('prepare_lock:remove:'),
        'preparing',
        30
      );

      // Verify commit phase
      expect(authDatabaseService.removeTokenFromBlacklist).toHaveBeenCalledWith(
        expect.any(String) // token hash
      );
      expect(redisService.removeFromBlacklist).toHaveBeenCalledWith(token);

      // Verify cleanup
      expect(redisService.delete).toHaveBeenCalledWith(
        expect.stringContaining('prepare_lock:remove:')
      );
    });

    it('should fail if token is not blacklisted in either storage', async () => {
      const token = 'test.jwt.token';
      const userId = 'user123';

      redisService.isTokenBlacklisted.mockResolvedValue(false);
      authDatabaseService.isTokenBlacklisted.mockResolvedValue(false);

      await expect(service.atomicRemoveFromBlacklist(token, userId)).rejects.toThrow(
        'Prepare failed for operation remove_from_blacklist: Token is not blacklisted in either Redis or PostgreSQL'
      );

      // Should not proceed to commit phase
      expect(authDatabaseService.removeTokenFromBlacklist).not.toHaveBeenCalled();
      expect(redisService.removeFromBlacklist).not.toHaveBeenCalled();
    });
  });

  describe('checkConsistency', () => {
    it('should detect no inconsistencies when storages are in sync', async () => {
      const mockDbTokens = [
        {
          tokenHash: 'hash1',
          userId: 'user1',
          expiresAt: new Date(Date.now() + 3600000),
          reason: 'logout' as const
        },
        {
          tokenHash: 'hash2',
          userId: 'user2',
          expiresAt: new Date(Date.now() + 3600000),
          reason: 'logout' as const
        }
      ];

      authDatabaseService.getAllBlacklistedTokens.mockResolvedValue(mockDbTokens as any);
      redisService.keys.mockResolvedValue(['blacklist:token1', 'blacklist:token2']);

      // Mock token hash creation to match exactly
      jest.spyOn(service as any, 'createTokenHash')
        .mockImplementation((token: string) => {
          if (token === 'token1') return 'hash1';
          if (token === 'token2') return 'hash2';
          return 'unknown_hash';
        });

      const result = await service.checkConsistency();

      expect(result.totalChecked).toBe(2);
      expect(result.inconsistencies).toBe(0);
      expect(result.redisOnly).toHaveLength(0);
      expect(result.postgresOnly).toHaveLength(0);
      expect(result.repaired).toBe(0);
    });

    it('should detect and repair Redis-only tokens', async () => {
      const mockDbTokens = [
        {
          tokenHash: 'hash1',
          userId: 'user1',
          expiresAt: new Date(Date.now() + 3600000),
          reason: 'logout' as const
        }
      ];

      authDatabaseService.getAllBlacklistedTokens.mockResolvedValue(mockDbTokens as any);
      redisService.keys.mockResolvedValue(['blacklist:token1', 'blacklist:orphan_token']);
      redisService.removeFromBlacklist.mockResolvedValue();

      // Mock token hash creation
      jest.spyOn(service as any, 'createTokenHash')
        .mockImplementation((token: string) => {
          if (token === 'token1') return 'hash1'; // matches DB
          if (token === 'orphan_token') return 'orphan_hash'; // doesn't match DB
          return 'unknown_hash';
        });

      const result = await service.checkConsistency();

      expect(result.totalChecked).toBe(1);
      expect(result.inconsistencies).toBe(1);
      expect(result.redisOnly).toContain('orphan_hash');
      expect(result.repaired).toBe(1);

      // Verify orphaned token was removed from Redis
      expect(redisService.removeFromBlacklist).toHaveBeenCalledWith('orphan_token');
    });

    it('should detect PostgreSQL-only tokens (cannot repair without original token)', async () => {
      const mockDbTokens = [
        {
          tokenHash: 'hash1',
          userId: 'user1',
          expiresAt: new Date(Date.now() + 3600000),
          reason: 'logout' as const
        },
        {
          tokenHash: 'orphan_hash',
          userId: 'user2',
          expiresAt: new Date(Date.now() + 3600000),
          reason: 'logout' as const
        }
      ];

      authDatabaseService.getAllBlacklistedTokens.mockResolvedValue(mockDbTokens as any);
      redisService.keys.mockResolvedValue(['blacklist:token1']);

      // Mock token hash creation - only first token matches
      jest.spyOn(service as any, 'createTokenHash')
        .mockImplementation((token: string) => {
          if (token === 'token1') return 'hash1';
          return 'unknown_hash';
        });

      const result = await service.checkConsistency();

      expect(result.totalChecked).toBe(2);
      expect(result.inconsistencies).toBe(1);
      expect(result.postgresOnly).toContain('orphan_hash');
      expect(result.repaired).toBe(0); // Cannot repair without original token
      expect(result.errors).toContainEqual(
        expect.stringContaining('Cannot restore token in Redis: hash orphan_hash')
      );
    });

    it('should handle errors gracefully during consistency check', async () => {
      authDatabaseService.getAllBlacklistedTokens.mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await service.checkConsistency();

      expect(result.totalChecked).toBe(0);
      expect(result.inconsistencies).toBe(0);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Consistency check failed: Database connection failed')
      );
    });
  });

  describe('getActiveTransactionsStats', () => {
    it('should return correct statistics for active transactions', () => {
      // Add some mock active transactions
      const mockContext1 = {
        transactionId: 'tx1',
        operations: [],
        status: 'preparing' as const,
        createdAt: new Date(Date.now() - 1000),
        timeout: 30000
      };

      const mockContext2 = {
        transactionId: 'tx2',
        operations: [],
        status: 'committed' as const,
        createdAt: new Date(Date.now() - 2000),
        timeout: 30000
      };

      // Access private property for testing
      (service as any).activeTransactions.set('tx1', mockContext1);
      (service as any).activeTransactions.set('tx2', mockContext2);

      const stats = service.getActiveTransactionsStats();

      expect(stats.total).toBe(2);
      expect(stats.byStatus).toEqual({
        preparing: 1,
        committed: 1
      });
      expect(stats.oldestTransaction).toEqual(mockContext2.createdAt);
    });

    it('should return empty stats when no active transactions', () => {
      const stats = service.getActiveTransactionsStats();

      expect(stats.total).toBe(0);
      expect(stats.byStatus).toEqual({});
      expect(stats.oldestTransaction).toBeUndefined();
    });
  });

  describe('cleanupStaleTransactions', () => {
    it('should cleanup transactions that exceed timeout', async () => {
      const oldDate = new Date(Date.now() - 60000); // 1 minute ago
      const mockStaleContext = {
        transactionId: 'stale_tx',
        operations: [{
          type: 'blacklist_token' as const,
          target: 'both' as const,
          data: mockTokenData,
          status: 'prepared' as const,
          compensationData: {
            prepareLockKey: 'prepare_lock:blacklist:hash123',
            action: 'blacklist_token'
          }
        }],
        status: 'prepared' as const,
        createdAt: oldDate,
        timeout: 30000 // 30 seconds timeout
      };

      // Add stale transaction
      (service as any).activeTransactions.set('stale_tx', mockStaleContext);

      redisService.delete.mockResolvedValue();

      const cleanedUp = await service.cleanupStaleTransactions();

      expect(cleanedUp).toBe(1);
      expect((service as any).activeTransactions.has('stale_tx')).toBe(false);
      expect(redisService.delete).toHaveBeenCalledWith('prepare_lock:blacklist:hash123');
    });

    it('should not cleanup transactions within timeout', async () => {
      const recentDate = new Date(Date.now() - 10000); // 10 seconds ago
      const mockRecentContext = {
        transactionId: 'recent_tx',
        operations: [],
        status: 'preparing' as const,
        createdAt: recentDate,
        timeout: 30000 // 30 seconds timeout
      };

      // Add recent transaction
      (service as any).activeTransactions.set('recent_tx', mockRecentContext);

      const cleanedUp = await service.cleanupStaleTransactions();

      expect(cleanedUp).toBe(0);
      expect((service as any).activeTransactions.has('recent_tx')).toBe(true);
    });
  });
});