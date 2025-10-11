import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { DatabaseOperationsService } from './database-operations.service';
import {
  SessionRepository,
  LoginAttemptRepository,
  TokenBlacklistRepository,
  SecurityEventRepository,
} from '../repositories';
import { Session, LoginAttempt, TokenBlacklist, SecurityEvent } from '../entities';

describe('DatabaseOperationsService', () => {
  let service: DatabaseOperationsService;
  let dataSource: jest.Mocked<DataSource>;
  let sessionRepository: jest.Mocked<SessionRepository>;
  let loginAttemptRepository: jest.Mocked<LoginAttemptRepository>;
  let tokenBlacklistRepository: jest.Mocked<TokenBlacklistRepository>;
  let securityEventRepository: jest.Mocked<SecurityEventRepository>;

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
  } as unknown as jest.Mocked<QueryRunner>;

  beforeEach(async () => {
    const mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
      query: jest.fn(),
    };

    const mockSessionRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      findByAccessToken: jest.fn(),
      findByRefreshToken: jest.fn(),
      updateLastAccessed: jest.fn(),
      deactivateSession: jest.fn(),
      deactivateAllUserSessions: jest.fn(),
      cleanupExpiredSessions: jest.fn(),
    };

    const mockLoginAttemptRepository = {
      create: jest.fn(),
      findRecentAttemptsByEmail: jest.fn(),
      findRecentAttemptsByIp: jest.fn(),
      countFailedAttemptsByEmail: jest.fn(),
      countFailedAttemptsByIp: jest.fn(),
      findByUserId: jest.fn(),
    };

    const mockTokenBlacklistRepository = {
      create: jest.fn(),
      findByTokenHash: jest.fn(),
      isTokenBlacklisted: jest.fn(),
      blacklistToken: jest.fn(),
      blacklistAllUserTokens: jest.fn(),
      findByUserId: jest.fn(),
      cleanupExpiredTokens: jest.fn(),
      countBlacklistedTokensByUser: jest.fn(),
    };

    const mockSecurityEventRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      findUnprocessedEvents: jest.fn(),
      markAsProcessed: jest.fn(),
      markMultipleAsProcessed: jest.fn(),
      findRecentEventsByType: jest.fn(),
      findRecentEventsByIp: jest.fn(),
      countEventsByUserAndType: jest.fn(),
      logSecurityEvent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseOperationsService,
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
        {
          provide: SessionRepository,
          useValue: mockSessionRepository,
        },
        {
          provide: LoginAttemptRepository,
          useValue: mockLoginAttemptRepository,
        },
        {
          provide: TokenBlacklistRepository,
          useValue: mockTokenBlacklistRepository,
        },
        {
          provide: SecurityEventRepository,
          useValue: mockSecurityEventRepository,
        },
      ],
    }).compile();

    service = module.get<DatabaseOperationsService>(DatabaseOperationsService);
    dataSource = module.get(getDataSourceToken());
    sessionRepository = module.get(SessionRepository);
    loginAttemptRepository = module.get(LoginAttemptRepository);
    tokenBlacklistRepository = module.get(TokenBlacklistRepository);
    securityEventRepository = module.get(SecurityEventRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Session Operations', () => {
    it('should create session successfully', async () => {
      const sessionData = {
        userId: 'user-123',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        expiresAt: new Date(),
      };

      const mockSession = { id: 'session-123', ...sessionData } as Session;
      sessionRepository.create.mockResolvedValue(mockSession);

      const result = await service.createSession(sessionData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSession);
      expect(sessionRepository.create).toHaveBeenCalledWith(sessionData);
    });

    it('should handle session creation error', async () => {
      const sessionData = {
        userId: 'user-123',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        expiresAt: new Date(),
      };

      const error = new Error('Database connection failed');
      error['code'] = '08003';
      sessionRepository.create.mockRejectedValue(error);

      const result = await service.createSession(sessionData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
      expect(result.code).toBe('CONNECTION_ERROR');
    });

    it('should find session by ID', async () => {
      const sessionId = 'session-123';
      const mockSession = { id: sessionId, userId: 'user-123' } as Session;
      sessionRepository.findById.mockResolvedValue(mockSession);

      const result = await service.findSessionById(sessionId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSession);
      expect(sessionRepository.findById).toHaveBeenCalledWith(sessionId);
    });

    it('should cleanup expired sessions', async () => {
      const cleanedCount = 5;
      sessionRepository.cleanupExpiredSessions.mockResolvedValue(cleanedCount);

      const result = await service.cleanupExpiredSessions();

      expect(result.success).toBe(true);
      expect(result.data).toBe(cleanedCount);
      expect(sessionRepository.cleanupExpiredSessions).toHaveBeenCalled();
    });
  });

  describe('Login Attempt Operations', () => {
    it('should create login attempt', async () => {
      const attemptData = {
        email: 'test@example.com',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        successful: true,
      };

      const mockAttempt = { id: 'attempt-123', ...attemptData } as LoginAttempt;
      loginAttemptRepository.create.mockResolvedValue(mockAttempt);

      const result = await service.createLoginAttempt(attemptData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAttempt);
      expect(loginAttemptRepository.create).toHaveBeenCalledWith(attemptData);
    });

    it('should count failed attempts by email', async () => {
      const email = 'test@example.com';
      const minutesBack = 15;
      const failedCount = 3;

      loginAttemptRepository.countFailedAttemptsByEmail.mockResolvedValue(failedCount);

      const result = await service.countFailedLoginAttemptsByEmail(email, minutesBack);

      expect(result.success).toBe(true);
      expect(result.data).toBe(failedCount);
      expect(loginAttemptRepository.countFailedAttemptsByEmail).toHaveBeenCalledWith(email, minutesBack);
    });
  });

  describe('Token Blacklist Operations', () => {
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

      tokenBlacklistRepository.blacklistToken.mockResolvedValue(mockBlacklistEntry);

      const result = await service.blacklistToken(tokenHash, userId, reason, expiresAt, metadata);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockBlacklistEntry);
      expect(tokenBlacklistRepository.blacklistToken).toHaveBeenCalledWith(
        tokenHash,
        userId,
        reason,
        expiresAt,
        metadata,
      );
    });

    it('should check if token is blacklisted', async () => {
      const tokenHash = 'token-hash';
      tokenBlacklistRepository.isTokenBlacklisted.mockResolvedValue(true);

      const result = await service.isTokenBlacklisted(tokenHash);

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
      expect(tokenBlacklistRepository.isTokenBlacklisted).toHaveBeenCalledWith(tokenHash);
    });
  });

  describe('Security Event Operations', () => {
    it('should log security event', async () => {
      const userId = 'user-123';
      const type = 'login' as SecurityEvent['type'];
      const ipAddress = '127.0.0.1';
      const userAgent = 'test-agent';
      const metadata = { source: 'web' };
      const severity = 'low' as SecurityEvent['severity'];

      const mockEvent = {
        id: 'event-123',
        userId,
        type,
        ipAddress,
        userAgent,
        metadata,
        severity,
        processed: false,
        createdAt: new Date(),
      } as SecurityEvent;

      securityEventRepository.logSecurityEvent.mockResolvedValue(mockEvent);

      const result = await service.logSecurityEvent(userId, type, ipAddress, userAgent, metadata, severity);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEvent);
      expect(securityEventRepository.logSecurityEvent).toHaveBeenCalledWith(
        userId,
        type,
        ipAddress,
        userAgent,
        metadata,
        severity,
      );
    });

    it('should find unprocessed events', async () => {
      const mockEvents = [
        { id: 'event-1', processed: false },
        { id: 'event-2', processed: false },
      ] as SecurityEvent[];

      securityEventRepository.findUnprocessedEvents.mockResolvedValue(mockEvents);

      const result = await service.findUnprocessedSecurityEvents();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEvents);
      expect(securityEventRepository.findUnprocessedEvents).toHaveBeenCalled();
    });
  });

  describe('Transaction Operations', () => {
    it('should execute transaction successfully', async () => {
      const mockResult = { success: true };
      const callback = jest.fn().mockResolvedValue(mockResult);

      const result = await service.executeInTransaction(callback, 'test-transaction');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(mockQueryRunner);
    });

    it('should rollback transaction on error', async () => {
      const error = new Error('Transaction failed');
      const callback = jest.fn().mockRejectedValue(error);

      const result = await service.executeInTransaction(callback, 'test-transaction');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction failed');
      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('Database Statistics', () => {
    it('should get database statistics', async () => {
      const mockStats = {
        activeSessions: 10,
        totalLoginAttempts24h: 50,
        failedLoginAttempts24h: 5,
        blacklistedTokens: 2,
        unprocessedSecurityEvents: 3,
      };

      dataSource.query
        .mockResolvedValueOnce([{ count: '10' }]) // active sessions
        .mockResolvedValueOnce([{ count: '50' }]) // total attempts
        .mockResolvedValueOnce([{ count: '5' }]) // failed attempts
        .mockResolvedValueOnce([{ count: '2' }]) // blacklisted tokens
        .mockResolvedValueOnce([{ count: '3' }]); // unprocessed events

      const result = await service.getDatabaseStatistics();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockStats);
      expect(dataSource.query).toHaveBeenCalledTimes(5);
    });
  });

  describe('Maintenance Tasks', () => {
    it('should perform maintenance tasks', async () => {
      const mockMaintenanceResult = {
        expiredSessions: 5,
        expiredTokens: 3,
        processedEvents: 10,
      };

      sessionRepository.cleanupExpiredSessions.mockResolvedValue(5);
      tokenBlacklistRepository.cleanupExpiredTokens.mockResolvedValue(3);
      securityEventRepository.findUnprocessedEvents.mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({ id: `event-${i}` })) as SecurityEvent[],
      );
      securityEventRepository.markMultipleAsProcessed.mockResolvedValue(undefined);

      const result = await service.performMaintenanceTasks();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockMaintenanceResult);
      expect(sessionRepository.cleanupExpiredSessions).toHaveBeenCalled();
      expect(tokenBlacklistRepository.cleanupExpiredTokens).toHaveBeenCalled();
      expect(securityEventRepository.findUnprocessedEvents).toHaveBeenCalled();
    });
  });

  describe('Error Code Mapping', () => {
    it('should map PostgreSQL error codes correctly', async () => {
      const duplicateError = new Error('Duplicate key violation');
      duplicateError['code'] = '23505';
      sessionRepository.create.mockRejectedValue(duplicateError);

      const result = await service.createSession({});

      expect(result.success).toBe(false);
      expect(result.code).toBe('DUPLICATE_ENTRY');
    });

    it('should handle unknown error codes', async () => {
      const unknownError = new Error('Unknown error');
      unknownError['code'] = '99999';
      sessionRepository.create.mockRejectedValue(unknownError);

      const result = await service.createSession({});

      expect(result.success).toBe(false);
      expect(result.code).toBe('DB_ERROR_99999');
    });

    it('should handle errors without codes', async () => {
      const genericError = new Error('Generic error');
      sessionRepository.create.mockRejectedValue(genericError);

      const result = await service.createSession({});

      expect(result.success).toBe(false);
      expect(result.code).toBe('UNKNOWN_ERROR');
    });
  });
});