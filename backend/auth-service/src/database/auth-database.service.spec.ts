import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { AuthDatabaseService } from './auth-database.service';
import { DatabaseOperationsService } from './database-operations.service';
import { Session, LoginAttempt, TokenBlacklist, SecurityEvent } from '../entities';

describe('AuthDatabaseService', () => {
  let service: AuthDatabaseService;
  let databaseOperations: jest.Mocked<DatabaseOperationsService>;

  beforeEach(async () => {
    const mockDatabaseOperations = {
      createSession: jest.fn(),
      findSessionById: jest.fn(),
      findSessionsByUserId: jest.fn(),
      findSessionByAccessToken: jest.fn(),
      findSessionByRefreshToken: jest.fn(),
      updateSessionLastAccessed: jest.fn(),
      deactivateSession: jest.fn(),
      deactivateAllUserSessions: jest.fn(),
      createLoginAttempt: jest.fn(),
      countFailedLoginAttemptsByEmail: jest.fn(),
      countFailedLoginAttemptsByIp: jest.fn(),
      findRecentLoginAttemptsByEmail: jest.fn(),
      findRecentLoginAttemptsByIp: jest.fn(),
      blacklistToken: jest.fn(),
      isTokenBlacklisted: jest.fn(),
      blacklistAllUserTokens: jest.fn(),
      findBlacklistedTokensByUserId: jest.fn(),
      logSecurityEvent: jest.fn(),
      findSecurityEventsByUserId: jest.fn(),
      findUnprocessedSecurityEvents: jest.fn(),
      markSecurityEventAsProcessed: jest.fn(),
      markMultipleSecurityEventsAsProcessed: jest.fn(),
      countSecurityEventsByUserAndType: jest.fn(),
      performMaintenanceTasks: jest.fn(),
      getDatabaseStatistics: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthDatabaseService,
        {
          provide: DatabaseOperationsService,
          useValue: mockDatabaseOperations,
        },
      ],
    }).compile();

    service = module.get<AuthDatabaseService>(AuthDatabaseService);
    databaseOperations = module.get(DatabaseOperationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Session Management', () => {
    it('should create user session successfully', async () => {
      const sessionData = {
        userId: 'user-123',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        expiresAt: new Date(),
      };

      const mockSession = {
        id: 'session-123',
        ...sessionData,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Session;

      databaseOperations.createSession.mockResolvedValue({
        success: true,
        data: mockSession,
      });

      const result = await service.createUserSession(sessionData);

      expect(result).toEqual(mockSession);
      expect(databaseOperations.createSession).toHaveBeenCalledWith({
        userId: sessionData.userId,
        accessToken: sessionData.accessToken,
        refreshToken: sessionData.refreshToken,
        ipAddress: sessionData.ipAddress,
        userAgent: sessionData.userAgent,
        expiresAt: sessionData.expiresAt,
        isActive: true,
      });
    });

    it('should throw BadRequestException for duplicate entry', async () => {
      const sessionData = {
        userId: 'user-123',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        expiresAt: new Date(),
      };

      databaseOperations.createSession.mockResolvedValue({
        success: false,
        error: 'Duplicate entry',
        code: 'DUPLICATE_ENTRY',
      });

      await expect(service.createUserSession(sessionData)).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException for connection error', async () => {
      const sessionData = {
        userId: 'user-123',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        expiresAt: new Date(),
      };

      databaseOperations.createSession.mockResolvedValue({
        success: false,
        error: 'Connection failed',
        code: 'CONNECTION_ERROR',
      });

      await expect(service.createUserSession(sessionData)).rejects.toThrow(InternalServerErrorException);
    });

    it('should find active session by ID', async () => {
      const sessionId = 'session-123';
      const mockSession = {
        id: sessionId,
        userId: 'user-123',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Session;

      databaseOperations.findSessionById.mockResolvedValue({
        success: true,
        data: mockSession,
      });

      const result = await service.findActiveSessionById(sessionId);

      expect(result).toEqual(mockSession);
      expect(databaseOperations.findSessionById).toHaveBeenCalledWith(sessionId);
    });

    it('should return null for inactive session', async () => {
      const sessionId = 'session-123';
      const mockSession = {
        id: sessionId,
        userId: 'user-123',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Session;

      databaseOperations.findSessionById.mockResolvedValue({
        success: true,
        data: mockSession,
      });

      const result = await service.findActiveSessionById(sessionId);

      expect(result).toBeNull();
    });
  });

  describe('Login Attempt Tracking', () => {
    it('should record login attempt', async () => {
      const attemptData = {
        email: 'test@example.com',
        userId: 'user-123',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        successful: true,
      };

      const mockAttempt = {
        id: 'attempt-123',
        ...attemptData,
        attemptedAt: new Date(),
      } as LoginAttempt;

      databaseOperations.createLoginAttempt.mockResolvedValue({
        success: true,
        data: mockAttempt,
      });

      const result = await service.recordLoginAttempt(attemptData);

      expect(result).toEqual(mockAttempt);
      expect(databaseOperations.createLoginAttempt).toHaveBeenCalledWith(attemptData);
    });

    it('should get recent failed logins by email', async () => {
      const email = 'test@example.com';
      const failedCount = 3;

      databaseOperations.countFailedLoginAttemptsByEmail.mockResolvedValue({
        success: true,
        data: failedCount,
      });

      const result = await service.getRecentFailedLoginsByEmail(email);

      expect(result).toBe(failedCount);
      expect(databaseOperations.countFailedLoginAttemptsByEmail).toHaveBeenCalledWith(email, 15);
    });
  });

  describe('Token Blacklist Management', () => {
    it('should blacklist token', async () => {
      const tokenHash = 'token-hash';
      const userId = 'user-123';
      const reason = 'logout' as TokenBlacklist['reason'];
      const expiresAt = new Date();
      const metadata = { source: 'manual' };

      const mockBlacklistEntry = {
        id: 'blacklist-123',
        tokenHash,
        userId,
        reason,
        expiresAt,
        metadata,
        blacklistedAt: new Date(),
      } as TokenBlacklist;

      databaseOperations.blacklistToken.mockResolvedValue({
        success: true,
        data: mockBlacklistEntry,
      });

      const result = await service.blacklistToken(tokenHash, userId, reason, expiresAt, metadata);

      expect(result).toEqual(mockBlacklistEntry);
      expect(databaseOperations.blacklistToken).toHaveBeenCalledWith(
        tokenHash,
        userId,
        reason,
        expiresAt,
        metadata,
      );
    });

    it('should check if token is blacklisted', async () => {
      const tokenHash = 'token-hash';

      databaseOperations.isTokenBlacklisted.mockResolvedValue({
        success: true,
        data: true,
      });

      const result = await service.isTokenBlacklisted(tokenHash);

      expect(result).toBe(true);
      expect(databaseOperations.isTokenBlacklisted).toHaveBeenCalledWith(tokenHash);
    });
  });

  describe('Security Event Logging', () => {
    it('should log security event', async () => {
      const eventData = {
        userId: 'user-123',
        type: 'login' as SecurityEvent['type'],
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        metadata: { source: 'web' },
        severity: 'low' as SecurityEvent['severity'],
      };

      const mockEvent = {
        id: 'event-123',
        ...eventData,
        processed: false,
        createdAt: new Date(),
      } as SecurityEvent;

      databaseOperations.logSecurityEvent.mockResolvedValue({
        success: true,
        data: mockEvent,
      });

      const result = await service.logSecurityEvent(eventData);

      expect(result).toEqual(mockEvent);
      expect(databaseOperations.logSecurityEvent).toHaveBeenCalledWith(
        eventData.userId,
        eventData.type,
        eventData.ipAddress,
        eventData.userAgent,
        eventData.metadata,
        'low',
      );
    });
  });

  describe('Utility Methods', () => {
    it('should check if user account is locked', async () => {
      const userId = 'user-123';
      const lockoutThreshold = 5;

      databaseOperations.countSecurityEventsByUserAndType.mockResolvedValue({
        success: true,
        data: 6, // Above threshold
      });

      const result = await service.isUserAccountLocked(userId, lockoutThreshold);

      expect(result).toBe(true);
      expect(databaseOperations.countSecurityEventsByUserAndType).toHaveBeenCalledWith(
        userId,
        'failed_login',
        lockoutThreshold,
      );
    });

    it('should get active session count', async () => {
      const userId = 'user-123';
      const mockSessions = [
        { id: 'session-1', userId, isActive: true },
        { id: 'session-2', userId, isActive: true },
      ] as Session[];

      databaseOperations.findSessionsByUserId.mockResolvedValue({
        success: true,
        data: mockSessions,
      });

      const result = await service.getActiveSessionCount(userId);

      expect(result).toBe(2);
      expect(databaseOperations.findSessionsByUserId).toHaveBeenCalledWith(userId);
    });

    it('should enforce max session limit', async () => {
      const userId = 'user-123';
      const maxSessions = 3;
      const mockSessions = [
        { id: 'session-1', userId, isActive: true, createdAt: new Date('2023-01-01') },
        { id: 'session-2', userId, isActive: true, createdAt: new Date('2023-01-02') },
        { id: 'session-3', userId, isActive: true, createdAt: new Date('2023-01-03') },
        { id: 'session-4', userId, isActive: true, createdAt: new Date('2023-01-04') },
      ] as Session[];

      databaseOperations.findSessionsByUserId.mockResolvedValue({
        success: true,
        data: mockSessions,
      });

      databaseOperations.deactivateSession.mockResolvedValue({
        success: true,
      });

      await service.enforceMaxSessionLimit(userId, maxSessions);

      // Should deactivate the oldest sessions (session-1 and session-2)
      expect(databaseOperations.deactivateSession).toHaveBeenCalledTimes(2);
      expect(databaseOperations.deactivateSession).toHaveBeenCalledWith('session-1');
      expect(databaseOperations.deactivateSession).toHaveBeenCalledWith('session-2');
    });
  });

  describe('Maintenance and Monitoring', () => {
    it('should perform database maintenance', async () => {
      const mockMaintenanceResult = {
        expiredSessions: 5,
        expiredTokens: 3,
        processedEvents: 10,
      };

      databaseOperations.performMaintenanceTasks.mockResolvedValue({
        success: true,
        data: mockMaintenanceResult,
      });

      const result = await service.performDatabaseMaintenance();

      expect(result).toEqual(mockMaintenanceResult);
      expect(databaseOperations.performMaintenanceTasks).toHaveBeenCalled();
    });

    it('should get database statistics', async () => {
      const mockStats = {
        activeSessions: 10,
        totalLoginAttempts24h: 50,
        failedLoginAttempts24h: 5,
        blacklistedTokens: 2,
        unprocessedSecurityEvents: 3,
      };

      databaseOperations.getDatabaseStatistics.mockResolvedValue({
        success: true,
        data: mockStats,
      });

      const result = await service.getDatabaseStatistics();

      expect(result).toEqual(mockStats);
      expect(databaseOperations.getDatabaseStatistics).toHaveBeenCalled();
    });
  });
});