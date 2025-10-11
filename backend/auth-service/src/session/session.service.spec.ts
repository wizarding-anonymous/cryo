import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SessionService, CreateSessionDto } from './session.service';
import { SessionRepository } from '../repositories/session.repository';
import { Session } from '../entities/session.entity';

describe('SessionService', () => {
  let service: SessionService;
  let sessionRepository: jest.Mocked<SessionRepository>;

  const mockSession: Session = {
    id: 'session-123',
    userId: 'user-123',
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-123',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    isActive: true,
    expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    lastAccessedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCreateSessionDto: CreateSessionDto = {
    userId: 'user-123',
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-123',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    expiresAt: new Date(Date.now() + 3600000),
  };

  beforeEach(async () => {
    const mockSessionRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByAccessToken: jest.fn(),
      findByRefreshToken: jest.fn(),
      findByUserId: jest.fn(),
      updateLastAccessed: jest.fn(),
      deactivateSession: jest.fn(),
      deactivateAllUserSessions: jest.fn(),
      cleanupExpiredSessions: jest.fn(),
      getSessionStats: jest.fn(),
      findSessionsByIpAddress: jest.fn(),
      findStaleSessionsOlderThan: jest.fn(),
      updateSessionMetadata: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: SessionRepository,
          useValue: mockSessionRepository,
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    sessionRepository = module.get(SessionRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSession', () => {
    it('should create a session with metadata tracking', async () => {
      sessionRepository.create.mockResolvedValue(mockSession);

      const result = await service.createSession(mockCreateSessionDto);

      expect(sessionRepository.create).toHaveBeenCalledWith({
        userId: mockCreateSessionDto.userId,
        accessToken: mockCreateSessionDto.accessToken,
        refreshToken: mockCreateSessionDto.refreshToken,
        ipAddress: mockCreateSessionDto.ipAddress,
        userAgent: mockCreateSessionDto.userAgent,
        expiresAt: mockCreateSessionDto.expiresAt,
        isActive: true,
        lastAccessedAt: expect.any(Date),
      });
      expect(result).toEqual(mockSession);
    });
  });

  describe('getSession', () => {
    it('should retrieve session and update last accessed timestamp', async () => {
      sessionRepository.findById.mockResolvedValue(mockSession);
      sessionRepository.updateLastAccessed.mockResolvedValue();

      const result = await service.getSession('session-123');

      expect(sessionRepository.findById).toHaveBeenCalledWith('session-123');
      expect(sessionRepository.updateLastAccessed).toHaveBeenCalledWith('session-123');
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
      sessionRepository.findById.mockResolvedValue(null);

      const result = await service.getSession('non-existent');

      expect(result).toBeNull();
      expect(sessionRepository.updateLastAccessed).not.toHaveBeenCalled();
    });
  });

  describe('getSessionByAccessToken', () => {
    it('should retrieve session by access token and update last accessed', async () => {
      sessionRepository.findByAccessToken.mockResolvedValue(mockSession);
      sessionRepository.updateLastAccessed.mockResolvedValue();

      const result = await service.getSessionByAccessToken('access-token-123');

      expect(sessionRepository.findByAccessToken).toHaveBeenCalledWith('access-token-123');
      expect(sessionRepository.updateLastAccessed).toHaveBeenCalledWith(mockSession.id);
      expect(result).toBeDefined();
      expect(result?.userId).toBe(mockSession.userId);
    });

    it('should return null if session not found by access token', async () => {
      sessionRepository.findByAccessToken.mockResolvedValue(null);

      const result = await service.getSessionByAccessToken('invalid-token');

      expect(result).toBeNull();
    });
  });

  describe('getSessionByRefreshToken', () => {
    it('should retrieve session by refresh token and update last accessed', async () => {
      sessionRepository.findByRefreshToken.mockResolvedValue(mockSession);
      sessionRepository.updateLastAccessed.mockResolvedValue();

      const result = await service.getSessionByRefreshToken('refresh-token-123');

      expect(sessionRepository.findByRefreshToken).toHaveBeenCalledWith('refresh-token-123');
      expect(sessionRepository.updateLastAccessed).toHaveBeenCalledWith(mockSession.id);
      expect(result).toBeDefined();
      expect(result?.userId).toBe(mockSession.userId);
    });
  });

  describe('validateSession', () => {
    it('should return true for valid active session', async () => {
      sessionRepository.findById.mockResolvedValue(mockSession);
      sessionRepository.updateLastAccessed.mockResolvedValue();

      const result = await service.validateSession('session-123');

      expect(result).toBe(true);
      expect(sessionRepository.updateLastAccessed).toHaveBeenCalledWith('session-123');
    });

    it('should return false for expired session', async () => {
      const expiredSession = {
        ...mockSession,
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      };
      sessionRepository.findById.mockResolvedValue(expiredSession);

      const result = await service.validateSession('session-123');

      expect(result).toBe(false);
      expect(sessionRepository.updateLastAccessed).not.toHaveBeenCalled();
    });

    it('should return false for inactive session', async () => {
      const inactiveSession = {
        ...mockSession,
        isActive: false,
      };
      sessionRepository.findById.mockResolvedValue(inactiveSession);

      const result = await service.validateSession('session-123');

      expect(result).toBe(false);
    });

    it('should return false for non-existent session', async () => {
      sessionRepository.findById.mockResolvedValue(null);

      const result = await service.validateSession('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('invalidateSession', () => {
    it('should invalidate existing session', async () => {
      sessionRepository.findById.mockResolvedValue(mockSession);
      sessionRepository.deactivateSession.mockResolvedValue();

      await service.invalidateSession('session-123');

      expect(sessionRepository.findById).toHaveBeenCalledWith('session-123');
      expect(sessionRepository.deactivateSession).toHaveBeenCalledWith('session-123');
    });

    it('should throw NotFoundException for non-existent session', async () => {
      sessionRepository.findById.mockResolvedValue(null);

      await expect(service.invalidateSession('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUserSessions', () => {
    it('should return all user sessions', async () => {
      const userSessions = [mockSession, { ...mockSession, id: 'session-456' }];
      sessionRepository.findByUserId.mockResolvedValue(userSessions);

      const result = await service.getUserSessions('user-123');

      expect(sessionRepository.findByUserId).toHaveBeenCalledWith('user-123');
      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe('user-123');
    });
  });

  describe('invalidateAllUserSessions', () => {
    it('should invalidate all sessions for a user', async () => {
      sessionRepository.deactivateAllUserSessions.mockResolvedValue();

      await service.invalidateAllUserSessions('user-123');

      expect(sessionRepository.deactivateAllUserSessions).toHaveBeenCalledWith('user-123');
    });
  });

  describe('enforceSessionLimit', () => {
    it('should deactivate oldest sessions when limit exceeded', async () => {
      const oldSession = {
        ...mockSession,
        id: 'old-session',
        createdAt: new Date(Date.now() - 7200000), // 2 hours ago
      };
      const newSession = {
        ...mockSession,
        id: 'new-session',
        createdAt: new Date(), // now
      };
      
      sessionRepository.findByUserId.mockResolvedValue([oldSession, newSession]);
      sessionRepository.deactivateSession.mockResolvedValue();

      await service.enforceSessionLimit('user-123', 1);

      expect(sessionRepository.deactivateSession).toHaveBeenCalledWith('old-session');
    });

    it('should not deactivate sessions when under limit', async () => {
      sessionRepository.findByUserId.mockResolvedValue([mockSession]);
      sessionRepository.deactivateSession.mockResolvedValue();

      await service.enforceSessionLimit('user-123', 5);

      expect(sessionRepository.deactivateSession).not.toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should cleanup expired sessions', async () => {
      sessionRepository.cleanupExpiredSessions.mockResolvedValue(5);

      await service.cleanupExpiredSessions();

      expect(sessionRepository.cleanupExpiredSessions).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      sessionRepository.cleanupExpiredSessions.mockRejectedValue(new Error('DB Error'));

      // Should not throw
      await service.cleanupExpiredSessions();

      expect(sessionRepository.cleanupExpiredSessions).toHaveBeenCalled();
    });
  });

  describe('performSessionCleanup', () => {
    it('should perform manual cleanup and return count', async () => {
      sessionRepository.cleanupExpiredSessions.mockResolvedValue(3);

      const result = await service.performSessionCleanup();

      expect(result).toBe(3);
      expect(sessionRepository.cleanupExpiredSessions).toHaveBeenCalled();
    });

    it('should throw error on cleanup failure', async () => {
      sessionRepository.cleanupExpiredSessions.mockRejectedValue(new Error('DB Error'));

      await expect(service.performSessionCleanup()).rejects.toThrow('DB Error');
    });
  });

  describe('getSessionStats', () => {
    it('should return session statistics', async () => {
      const mockStats = {
        totalActiveSessions: 10,
        totalExpiredSessions: 2,
        sessionsPerUser: { 'user-123': 3, 'user-456': 2 },
      };
      sessionRepository.getSessionStats.mockResolvedValue(mockStats);

      const result = await service.getSessionStats();

      expect(sessionRepository.getSessionStats).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });

    it('should handle stats retrieval errors', async () => {
      sessionRepository.getSessionStats.mockRejectedValue(new Error('Stats Error'));

      await expect(service.getSessionStats()).rejects.toThrow('Stats Error');
    });
  });

  describe('getSessionsByIpAddress', () => {
    it('should return sessions for specific IP address', async () => {
      const ipSessions = [mockSession, { ...mockSession, id: 'session-456' }];
      sessionRepository.findSessionsByIpAddress.mockResolvedValue(ipSessions);

      const result = await service.getSessionsByIpAddress('192.168.1.1');

      expect(sessionRepository.findSessionsByIpAddress).toHaveBeenCalledWith('192.168.1.1');
      expect(result).toHaveLength(2);
      expect(result[0].ipAddress).toBe('192.168.1.1');
    });
  });

  describe('findStaleSessionsOlderThan', () => {
    it('should return stale sessions older than specified hours', async () => {
      const staleSessions = [mockSession];
      sessionRepository.findStaleSessionsOlderThan.mockResolvedValue(staleSessions);

      const result = await service.findStaleSessionsOlderThan(24);

      expect(sessionRepository.findStaleSessionsOlderThan).toHaveBeenCalledWith(24);
      expect(result).toHaveLength(1);
    });
  });

  describe('updateSessionMetadata', () => {
    it('should update session metadata', async () => {
      sessionRepository.findById.mockResolvedValue(mockSession);
      sessionRepository.updateSessionMetadata.mockResolvedValue();

      await service.updateSessionMetadata('session-123', '192.168.1.2', 'New User Agent');

      expect(sessionRepository.findById).toHaveBeenCalledWith('session-123');
      expect(sessionRepository.updateSessionMetadata).toHaveBeenCalledWith(
        'session-123',
        '192.168.1.2',
        'New User Agent'
      );
    });

    it('should throw NotFoundException for non-existent session', async () => {
      sessionRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateSessionMetadata('non-existent', '192.168.1.2', 'New User Agent')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cleanupStaleSessions', () => {
    it('should cleanup stale sessions and return count', async () => {
      const staleSessions = [mockSession, { ...mockSession, id: 'session-456' }];
      sessionRepository.findStaleSessionsOlderThan.mockResolvedValue(staleSessions);
      sessionRepository.deactivateSession.mockResolvedValue();

      const result = await service.cleanupStaleSessions(72);

      expect(sessionRepository.findStaleSessionsOlderThan).toHaveBeenCalledWith(72);
      expect(sessionRepository.deactivateSession).toHaveBeenCalledTimes(2);
      expect(result).toBe(2);
    });

    it('should handle cleanup errors', async () => {
      sessionRepository.findStaleSessionsOlderThan.mockRejectedValue(new Error('Cleanup Error'));

      await expect(service.cleanupStaleSessions(72)).rejects.toThrow('Cleanup Error');
    });
  });

  describe('cleanupStaleSessionsScheduled', () => {
    it('should cleanup stale sessions on schedule', async () => {
      const staleSessions = [mockSession];
      sessionRepository.findStaleSessionsOlderThan.mockResolvedValue(staleSessions);
      sessionRepository.deactivateSession.mockResolvedValue();

      await service.cleanupStaleSessionsScheduled();

      expect(sessionRepository.findStaleSessionsOlderThan).toHaveBeenCalledWith(72);
      expect(sessionRepository.deactivateSession).toHaveBeenCalledWith(mockSession.id);
    });

    it('should handle scheduled cleanup errors gracefully', async () => {
      sessionRepository.findStaleSessionsOlderThan.mockRejectedValue(new Error('Scheduled Error'));

      // Should not throw
      await service.cleanupStaleSessionsScheduled();

      expect(sessionRepository.findStaleSessionsOlderThan).toHaveBeenCalled();
    });
  });
});