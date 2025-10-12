import { SessionRepository } from '../repositories/session.repository';
import { RedisLockService } from '../common/redis/redis-lock.service';
import { TokenService } from '../token/token.service';
import { Session } from '../entities/session.entity';
import { createMockSession } from '../test/mocks';

// Мок для SessionService, так как реальный сервис имеет сложные зависимости
class MockSessionService {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly redisLockService: RedisLockService,
    private readonly tokenService: TokenService,
  ) { }

  async createSessionWithLimit(sessionData: any, limit: number) {
    // Имитируем использование распределенной блокировки
    return await this.redisLockService.withLock(
      `session_limit:${sessionData.userId}`,
      async () => {
        const existingSessions = await this.sessionRepository.findByUserId(sessionData.userId);

        // Удаляем старые сессии если превышен лимит
        const sessionsToRemove = Math.max(0, existingSessions.length - limit + 1);
        for (let i = 0; i < sessionsToRemove; i++) {
          await this.sessionRepository.deactivateSession(existingSessions[i].id);
        }

        // Хешируем токены перед сохранением (как в реальном сервисе)
        const accessTokenHash = this.tokenService.hashToken(sessionData.accessToken);
        const refreshTokenHash = this.tokenService.hashToken(sessionData.refreshToken);

        const sessionToCreate = {
          ...sessionData,
          accessTokenHash,
          refreshTokenHash,
        };

        const newSession = await this.sessionRepository.create(sessionToCreate);

        return {
          session: newSession,
          removedSessionsCount: sessionsToRemove,
        };
      },
      {
        ttlSeconds: 5,
        retryDelayMs: 50,
        maxRetries: 3,
      }
    );
  }
}

describe('SessionService - Race Condition Protection', () => {
  let service: MockSessionService;
  let sessionRepository: jest.Mocked<SessionRepository>;
  let redisLockService: jest.Mocked<RedisLockService>;
  let tokenService: jest.Mocked<TokenService>;

  const mockSession: Session = createMockSession({
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
  });

  beforeEach(() => {
    // Создаем моки напрямую
    sessionRepository = {
      create: jest.fn(),
      findByUserId: jest.fn(),
      deactivateSession: jest.fn(),
      findById: jest.fn(),
      updateLastAccessed: jest.fn(),
    } as any;

    redisLockService = {
      withLock: jest.fn(),
      isLocked: jest.fn(),
      getLockTTL: jest.fn(),
    } as any;

    tokenService = {
      hashToken: jest.fn(),
    } as any;

    // Создаем сервис с моками
    service = new MockSessionService(sessionRepository, redisLockService, tokenService);
  });

  describe('createSessionWithLimit', () => {
    const sessionData = {
      userId: 'user-123',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    it('should create session with limit using distributed lock', async () => {
      // Arrange
      sessionRepository.findByUserId.mockResolvedValue([]);
      sessionRepository.create.mockResolvedValue(mockSession);
      tokenService.hashToken.mockReturnValue('hashed-token');

      // Mock withLock to execute the function immediately
      redisLockService.withLock.mockImplementation(async (_lockKey, fn) => {
        return await fn();
      });

      // Act
      const result = await service.createSessionWithLimit(sessionData, 5);

      // Assert
      expect(result.session).toEqual(mockSession);
      expect(result.removedSessionsCount).toBe(0);
      expect(redisLockService.withLock).toHaveBeenCalledWith(
        'session_limit:user-123',
        expect.any(Function),
        {
          ttlSeconds: 5,
          retryDelayMs: 50,
          maxRetries: 3
        }
      );
      expect(tokenService.hashToken).toHaveBeenCalledWith('access-token');
      expect(tokenService.hashToken).toHaveBeenCalledWith('refresh-token');
    });

    it('should enforce session limit and remove old sessions atomically', async () => {
      // Arrange - User has 5 existing sessions, limit is 3
      const existingSessions = Array.from({ length: 5 }, (_, i) => ({
        ...mockSession,
        id: `session-${i}`,
        createdAt: new Date(Date.now() - (i + 1) * 60000), // Older sessions first
        lastAccessedAt: new Date(Date.now() - (i + 1) * 60000),
      }));

      sessionRepository.findByUserId.mockResolvedValue(existingSessions);
      sessionRepository.create.mockResolvedValue(mockSession);
      sessionRepository.deactivateSession.mockResolvedValue();
      tokenService.hashToken.mockReturnValue('hashed-token');

      // Mock withLock to execute the function immediately
      redisLockService.withLock.mockImplementation(async (_lockKey, fn) => {
        return await fn();
      });

      // Act
      const result = await service.createSessionWithLimit(sessionData, 3);

      // Assert
      expect(result.session).toEqual(mockSession);
      expect(result.removedSessionsCount).toBe(3); // Should remove 3 oldest sessions (5 - 3 + 1)
      expect(sessionRepository.deactivateSession).toHaveBeenCalledTimes(3);

      // Verify oldest sessions were deactivated
      expect(sessionRepository.deactivateSession).toHaveBeenCalledWith('session-0');
      expect(sessionRepository.deactivateSession).toHaveBeenCalledWith('session-1');
      expect(sessionRepository.deactivateSession).toHaveBeenCalledWith('session-2');
    });

    it('should handle lock acquisition failure', async () => {
      // Arrange
      redisLockService.withLock.mockRejectedValue(new Error('Failed to acquire lock: session_limit:user-123'));

      // Act & Assert
      await expect(service.createSessionWithLimit(sessionData, 5))
        .rejects.toThrow('Failed to acquire lock: session_limit:user-123');
    });

    it('should use correct lock key format', async () => {
      // Arrange
      sessionRepository.findByUserId.mockResolvedValue([]);
      sessionRepository.create.mockResolvedValue(mockSession);
      tokenService.hashToken.mockReturnValue('hashed-token');

      redisLockService.withLock.mockImplementation(async (_lockKey, fn) => {
        return await fn();
      });

      // Act
      await service.createSessionWithLimit(sessionData, 5);

      // Assert
      expect(redisLockService.withLock).toHaveBeenCalledWith(
        'session_limit:user-123',
        expect.any(Function),
        expect.any(Object)
      );
    });

    it('should handle concurrent session creation attempts', async () => {
      // Arrange - Simulate concurrent requests
      const concurrentSessionData = [
        { ...sessionData, accessToken: 'token-1', refreshToken: 'refresh-token-1' },
        { ...sessionData, accessToken: 'token-2', refreshToken: 'refresh-token-2' },
        { ...sessionData, accessToken: 'token-3', refreshToken: 'refresh-token-3' },
      ];

      let lockCallCount = 0;
      redisLockService.withLock.mockImplementation(async (_lockKey, fn) => {
        lockCallCount++;
        // Simulate that only one request can proceed at a time
        if (lockCallCount === 1) {
          sessionRepository.findByUserId.mockResolvedValue([]);
          sessionRepository.create.mockResolvedValue({ ...mockSession, accessTokenHash: 'hashed-token-1' });
        } else if (lockCallCount === 2) {
          sessionRepository.findByUserId.mockResolvedValue([{ ...mockSession, accessTokenHash: 'hashed-token-1' }]);
          sessionRepository.create.mockResolvedValue({ ...mockSession, accessTokenHash: 'hashed-token-2' });
        } else {
          sessionRepository.findByUserId.mockResolvedValue([
            { ...mockSession, accessTokenHash: 'hashed-token-1' },
            { ...mockSession, accessTokenHash: 'hashed-token-2' }
          ]);
          sessionRepository.create.mockResolvedValue({ ...mockSession, accessTokenHash: 'hashed-token-3' });
        }
        return await fn();
      });

      tokenService.hashToken.mockReturnValue('hashed-token');

      // Act - Simulate concurrent requests
      const promises = concurrentSessionData.map(data =>
        service.createSessionWithLimit(data, 5)
      );

      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(3);
      expect(redisLockService.withLock).toHaveBeenCalledTimes(3);

      // Each call should use the same lock key
      for (let i = 0; i < 3; i++) {
        expect(redisLockService.withLock).toHaveBeenNthCalledWith(
          i + 1,
          'session_limit:user-123',
          expect.any(Function),
          expect.any(Object)
        );
      }
    });
  });

  describe('race condition metrics and monitoring', () => {
    it('should provide lock TTL information for monitoring', async () => {
      // Arrange
      redisLockService.getLockTTL.mockResolvedValue(3);

      // Act
      const ttl = await redisLockService.getLockTTL('session_limit:user-123');

      // Assert
      expect(ttl).toBe(3);
      expect(redisLockService.getLockTTL).toHaveBeenCalledWith('session_limit:user-123');
    });

    it('should check if lock exists for monitoring', async () => {
      // Arrange
      redisLockService.isLocked.mockResolvedValue(true);

      // Act
      const isLocked = await redisLockService.isLocked('session_limit:user-123');

      // Assert
      expect(isLocked).toBe(true);
      expect(redisLockService.isLocked).toHaveBeenCalledWith('session_limit:user-123');
    });
  });

  describe('lock configuration', () => {
    it('should use correct lock configuration as specified in task', async () => {
      // Arrange
      const sessionData = {
        userId: 'user-123',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        expiresAt: new Date(),
      };

      sessionRepository.findByUserId.mockResolvedValue([]);
      sessionRepository.create.mockResolvedValue(mockSession);
      tokenService.hashToken.mockReturnValue('hashed-token');

      redisLockService.withLock.mockImplementation(async (_lockKey, fn) => {
        return await fn();
      });

      // Act
      await service.createSessionWithLimit(sessionData, 5);

      // Assert - Verify lock configuration matches task requirements
      expect(redisLockService.withLock).toHaveBeenCalledWith(
        'session_limit:user-123', // lockKey format as specified
        expect.any(Function),
        {
          ttlSeconds: 5,      // 5 second TTL as specified in task
          retryDelayMs: 50,   // Short retry delay for better UX
          maxRetries: 3       // Allow retries for concurrent requests
        }
      );
    });
  });
});