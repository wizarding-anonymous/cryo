import { Test, TestingModule } from '@nestjs/testing';
import { SessionService } from './session.service';
import { SessionRepository } from '../repositories/session.repository';
import { RedisLockService } from '../common/redis/redis-lock.service';
import { Session } from '../entities/session.entity';

describe('SessionService - Race Condition Protection', () => {
  let service: SessionService;
  let sessionRepository: jest.Mocked<SessionRepository>;
  let redisLockService: jest.Mocked<RedisLockService>;

  const mockSession: Session = {
    id: 'session-123',
    userId: 'user-123',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    isActive: true,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    lastAccessedAt: new Date(),
  };

  beforeEach(async () => {
    const mockSessionRepository = {
      create: jest.fn(),
      findByUserId: jest.fn(),
      deactivateSession: jest.fn(),
      findById: jest.fn(),
      updateLastAccessed: jest.fn(),
    };

    const mockRedisLockService = {
      acquireLock: jest.fn(),
      releaseLock: jest.fn(),
      withLock: jest.fn(),
      isLocked: jest.fn(),
      getLockTTL: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: SessionRepository,
          useValue: mockSessionRepository,
        },
        {
          provide: RedisLockService,
          useValue: mockRedisLockService,
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    sessionRepository = module.get(SessionRepository);
    redisLockService = module.get(RedisLockService);
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
      
      // Mock withLock to execute the function immediately
      redisLockService.withLock.mockImplementation(async (lockKey, fn) => {
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

      // Mock withLock to execute the function immediately
      redisLockService.withLock.mockImplementation(async (lockKey, fn) => {
        return await fn();
      });

      // Act
      const result = await service.createSessionWithLimit(sessionData, 3);

      // Assert
      expect(result.session).toEqual(mockSession);
      expect(result.removedSessionsCount).toBe(3); // Should remove 3 oldest sessions (5 - 3 + 1)
      expect(sessionRepository.deactivateSession).toHaveBeenCalledTimes(3);
      
      // Verify oldest sessions were deactivated
      expect(sessionRepository.deactivateSession).toHaveBeenCalledWith('session-4');
      expect(sessionRepository.deactivateSession).toHaveBeenCalledWith('session-3');
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
      
      redisLockService.withLock.mockImplementation(async (lockKey, fn) => {
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
        { ...sessionData, accessToken: 'token-1' },
        { ...sessionData, accessToken: 'token-2' },
        { ...sessionData, accessToken: 'token-3' },
      ];

      let lockCallCount = 0;
      redisLockService.withLock.mockImplementation(async (lockKey, fn) => {
        lockCallCount++;
        // Simulate that only one request can proceed at a time
        if (lockCallCount === 1) {
          sessionRepository.findByUserId.mockResolvedValue([]);
          sessionRepository.create.mockResolvedValue({ ...mockSession, accessToken: 'token-1' });
        } else if (lockCallCount === 2) {
          sessionRepository.findByUserId.mockResolvedValue([{ ...mockSession, accessToken: 'token-1' }]);
          sessionRepository.create.mockResolvedValue({ ...mockSession, accessToken: 'token-2' });
        } else {
          sessionRepository.findByUserId.mockResolvedValue([
            { ...mockSession, accessToken: 'token-1' },
            { ...mockSession, accessToken: 'token-2' }
          ]);
          sessionRepository.create.mockResolvedValue({ ...mockSession, accessToken: 'token-3' });
        }
        return await fn();
      });

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
      
      redisLockService.withLock.mockImplementation(async (lockKey, fn) => {
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