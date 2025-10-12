import { SessionService, CreateSessionDto } from './session.service';
import { SessionRepository } from '../repositories/session.repository';
import { RedisLockService } from '../common/redis/redis-lock.service';
import { TokenService } from '../token/token.service';
import { Session } from '../entities/session.entity';
import { RaceConditionMetricsService } from '../common/metrics/race-condition-metrics.service';
import { createMockSession } from '../test/mocks';
import { createHash } from 'crypto';

describe('SessionService', () => {
  let service: SessionService;
  let sessionRepository: jest.Mocked<SessionRepository>;
  let redisLockService: jest.Mocked<RedisLockService>;
  let metricsService: jest.Mocked<RaceConditionMetricsService>;
  let tokenService: jest.Mocked<TokenService>;

  beforeEach(() => {
    // Создаем моки напрямую
    sessionRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      findByAccessTokenHash: jest.fn(),
      findByRefreshTokenHash: jest.fn(),
      updateLastAccessed: jest.fn(),
      deactivateSession: jest.fn(),
      deactivateAllUserSessions: jest.fn(),
      cleanupExpiredSessions: jest.fn(),
      countActiveSessionsByUserId: jest.fn(),
      getSessionStats: jest.fn(),
      findSessionsByIpAddress: jest.fn(),
      findStaleSessionsOlderThan: jest.fn(),
      updateSessionMetadata: jest.fn(),
    } as any;

    redisLockService = {
      withLock: jest.fn(),
      isLocked: jest.fn(),
      getLockTTL: jest.fn(),
    } as any;

    tokenService = {
      hashToken: jest.fn(),
    } as any;

    metricsService = {
      recordLockAttempt: jest.fn(),
      recordConcurrentSessionCreation: jest.fn(),
      getMetrics: jest.fn(),
      getPrometheusMetrics: jest.fn(),
      resetMetrics: jest.fn(),
      getLockSuccessRate: jest.fn(),
      getLockConflictRate: jest.fn(),
      getHealthStatus: jest.fn(),
    } as any;

    // Создаем сервис с моками
    service = new SessionService(
      sessionRepository,
      redisLockService,
      metricsService,
      tokenService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create session with hashed tokens', async () => {
      // Requirement 15.2: Secure token storage with SHA-256 hashes
      const sessionData: CreateSessionDto = {
        userId: 'user-123',
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        expiresAt: new Date(),
      };

      const accessTokenHash = createHash('sha256').update(sessionData.accessToken).digest('hex');
      const refreshTokenHash = createHash('sha256').update(sessionData.refreshToken).digest('hex');

      tokenService.hashToken
        .mockReturnValueOnce(accessTokenHash)
        .mockReturnValueOnce(refreshTokenHash);

      const mockSession = {
        id: 'session-123',
        userId: sessionData.userId,
        accessTokenHash,
        refreshTokenHash,
        ipAddress: sessionData.ipAddress,
        userAgent: sessionData.userAgent,
        isActive: true,
        expiresAt: sessionData.expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Session;

      sessionRepository.create.mockResolvedValue(mockSession);

      const result = await service.createSession(sessionData);

      expect(tokenService.hashToken).toHaveBeenCalledWith(sessionData.accessToken);
      expect(tokenService.hashToken).toHaveBeenCalledWith(sessionData.refreshToken);
      expect(sessionRepository.create).toHaveBeenCalledWith({
        userId: sessionData.userId,
        accessTokenHash,
        refreshTokenHash,
        ipAddress: sessionData.ipAddress,
        userAgent: sessionData.userAgent,
        expiresAt: sessionData.expiresAt,
        isActive: true,
        lastAccessedAt: expect.any(Date),
      });
      expect(result).toBe(mockSession);
    });
  });

  describe('getSessionByAccessToken', () => {
    it('should find session by access token hash', async () => {
      // Requirement 15.2: Secure token lookup using SHA-256 hash
      const accessToken = 'access-token-123';
      const accessTokenHash = createHash('sha256').update(accessToken).digest('hex');
      
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        accessTokenHash,
        refreshTokenHash: 'refresh-hash',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        isActive: true,
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      } as Session;

      tokenService.hashToken.mockReturnValue(accessTokenHash);
      sessionRepository.findByAccessTokenHash.mockResolvedValue(mockSession);
      sessionRepository.updateLastAccessed.mockResolvedValue(undefined);

      const result = await service.getSessionByAccessToken(accessToken);

      expect(tokenService.hashToken).toHaveBeenCalledWith(accessToken);
      expect(sessionRepository.findByAccessTokenHash).toHaveBeenCalledWith(accessTokenHash);
      expect(sessionRepository.updateLastAccessed).toHaveBeenCalledWith(mockSession.id);
      expect(result).toEqual({
        id: mockSession.id,
        userId: mockSession.userId,
        ipAddress: mockSession.ipAddress,
        userAgent: mockSession.userAgent,
        isActive: mockSession.isActive,
        createdAt: mockSession.createdAt,
        expiresAt: mockSession.expiresAt,
        lastAccessedAt: expect.any(Date),
      });
    });

    it('should return null if session not found', async () => {
      const accessToken = 'non-existent-token';
      const accessTokenHash = createHash('sha256').update(accessToken).digest('hex');

      tokenService.hashToken.mockReturnValue(accessTokenHash);
      sessionRepository.findByAccessTokenHash.mockResolvedValue(null);

      const result = await service.getSessionByAccessToken(accessToken);

      expect(result).toBeNull();
      expect(sessionRepository.updateLastAccessed).not.toHaveBeenCalled();
    });
  });

  describe('getSessionByRefreshToken', () => {
    it('should find session by refresh token hash', async () => {
      // Requirement 15.2: Secure token lookup using SHA-256 hash
      const refreshToken = 'refresh-token-123';
      const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');
      
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        accessTokenHash: 'access-hash',
        refreshTokenHash,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        isActive: true,
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      } as Session;

      tokenService.hashToken.mockReturnValue(refreshTokenHash);
      sessionRepository.findByRefreshTokenHash.mockResolvedValue(mockSession);
      sessionRepository.updateLastAccessed.mockResolvedValue(undefined);

      const result = await service.getSessionByRefreshToken(refreshToken);

      expect(tokenService.hashToken).toHaveBeenCalledWith(refreshToken);
      expect(sessionRepository.findByRefreshTokenHash).toHaveBeenCalledWith(refreshTokenHash);
      expect(sessionRepository.updateLastAccessed).toHaveBeenCalledWith(mockSession.id);
      expect(result).toEqual({
        id: mockSession.id,
        userId: mockSession.userId,
        ipAddress: mockSession.ipAddress,
        userAgent: mockSession.userAgent,
        isActive: mockSession.isActive,
        createdAt: mockSession.createdAt,
        expiresAt: mockSession.expiresAt,
        lastAccessedAt: expect.any(Date),
      });
    });
  });

  describe('createSessionWithLimit', () => {
    it('should use distributed lock to prevent race conditions', async () => {
      // Requirement 15.1: Race condition protection using Redis locks
      const sessionData: CreateSessionDto = {
        userId: 'user-123',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        expiresAt: new Date(),
      };

      const mockSession = {
        id: 'session-123',
        userId: sessionData.userId,
      } as Session;



      redisLockService.withLock.mockImplementation(async (lockKey: string, callback: () => any) => {
        expect(lockKey).toBe(`session_limit:${sessionData.userId}`);
        return callback();
      });

      // Mock the internal methods that would be called within the lock
      sessionRepository.findByUserId.mockResolvedValue([]);
      sessionRepository.create.mockResolvedValue(mockSession);
      tokenService.hashToken.mockReturnValue('hashed-token');

      const result = await service.createSessionWithLimit(sessionData, 5);

      expect(metricsService.recordConcurrentSessionCreation).toHaveBeenCalled();
      expect(redisLockService.withLock).toHaveBeenCalledWith(
        `session_limit:${sessionData.userId}`,
        expect.any(Function),
        {
          ttlSeconds: 5,
          retryDelayMs: 50,
          maxRetries: 3,
        }
      );
      expect(result.session).toBe(mockSession);
      expect(result.removedSessionsCount).toBe(0);
    });
  });

  describe('enforceSessionLimit', () => {
    it('should remove oldest sessions when limit is exceeded', async () => {
      const userId = 'user-123';
      const maxSessions = 3;
      
      const mockSessions = [
        {
          id: 'session-1',
          lastAccessedAt: new Date('2023-01-01'),
          createdAt: new Date('2023-01-01'),
        },
        {
          id: 'session-2',
          lastAccessedAt: new Date('2023-01-02'),
          createdAt: new Date('2023-01-02'),
        },
        {
          id: 'session-3',
          lastAccessedAt: new Date('2023-01-03'),
          createdAt: new Date('2023-01-03'),
        },
        {
          id: 'session-4',
          lastAccessedAt: null, // Should use createdAt
          createdAt: new Date('2023-01-04'),
        },
      ] as Session[];

      sessionRepository.findByUserId.mockResolvedValue(mockSessions);
      sessionRepository.deactivateSession.mockResolvedValue(undefined);

      const result = await service.enforceSessionLimit(userId, maxSessions);

      expect(result).toBe(2); // Should remove 2 sessions (4 - 3 + 1)
      expect(sessionRepository.deactivateSession).toHaveBeenCalledWith('session-1');
      expect(sessionRepository.deactivateSession).toHaveBeenCalledWith('session-2');
      expect(sessionRepository.deactivateSession).toHaveBeenCalledTimes(2);
    });

    it('should not remove sessions if under limit', async () => {
      const userId = 'user-123';
      const maxSessions = 5;
      
      const mockSessions = [
        { id: 'session-1' },
        { id: 'session-2' },
      ] as Session[];

      sessionRepository.findByUserId.mockResolvedValue(mockSessions);

      const result = await service.enforceSessionLimit(userId, maxSessions);

      expect(result).toBe(0);
      expect(sessionRepository.deactivateSession).not.toHaveBeenCalled();
    });
  });

  describe('invalidateAllUserSessions', () => {
    it('should invalidate all sessions for a user', async () => {
      const userId = 'user-123';
      const mockSessions = [
        { id: 'session-1' },
        { id: 'session-2' },
        { id: 'session-3' },
      ] as Session[];

      sessionRepository.findByUserId.mockResolvedValue(mockSessions);
      sessionRepository.deactivateAllUserSessions.mockResolvedValue(undefined);

      const result = await service.invalidateAllUserSessions(userId, 'security_event');

      expect(result).toBe(3);
      expect(sessionRepository.deactivateAllUserSessions).toHaveBeenCalledWith(userId);
    });
  });

  describe('validateSession', () => {
    it('should validate active and non-expired session', async () => {
      const sessionId = 'session-123';
      const mockSession = {
        id: sessionId,
        isActive: true,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      } as Session;

      sessionRepository.findById.mockResolvedValue(mockSession);
      sessionRepository.updateLastAccessed.mockResolvedValue(undefined);

      const result = await service.validateSession(sessionId);

      expect(result).toBe(true);
      expect(sessionRepository.updateLastAccessed).toHaveBeenCalledWith(sessionId);
    });

    it('should invalidate expired session', async () => {
      const sessionId = 'session-123';
      const mockSession = {
        id: sessionId,
        isActive: true,
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      } as Session;

      sessionRepository.findById.mockResolvedValue(mockSession);

      const result = await service.validateSession(sessionId);

      expect(result).toBe(false);
      expect(sessionRepository.updateLastAccessed).not.toHaveBeenCalled();
    });

    it('should invalidate inactive session', async () => {
      const sessionId = 'session-123';
      const mockSession = {
        id: sessionId,
        isActive: false,
        expiresAt: new Date(Date.now() + 3600000),
      } as Session;

      sessionRepository.findById.mockResolvedValue(mockSession);

      const result = await service.validateSession(sessionId);

      expect(result).toBe(false);
    });

    it('should return false for non-existent session', async () => {
      const sessionId = 'non-existent';

      sessionRepository.findById.mockResolvedValue(null);

      const result = await service.validateSession(sessionId);

      expect(result).toBe(false);
    });
  });
});