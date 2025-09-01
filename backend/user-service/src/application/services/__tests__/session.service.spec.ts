import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { SessionService, DeviceInfo } from '../session.service';
import { Session } from '../../../domain/entities/session.entity';
import { User } from '../../../domain/entities/user.entity';
import { EventPublisher } from '../../events/event-publisher.service';
import { NotFoundException } from '@nestjs/common';

describe('SessionService', () => {
  let service: SessionService;
  let sessionRepository: jest.Mocked<Repository<Session>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let jwtService: jest.Mocked<JwtService>;
  let eventPublisher: jest.Mocked<EventPublisher>;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    isActive: true,
    isBlocked: false,
  } as User;

  const mockDeviceInfo: DeviceInfo = {
    type: 'desktop',
    os: 'Windows',
    browser: 'Chrome',
    browserVersion: '120.0',
    version: '120.0',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: getRepositoryToken(Session),
          useValue: {
            findOneBy: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              update: jest.fn().mockReturnThis(),
              set: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              execute: jest.fn(),
            })),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOneBy: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: EventPublisher,
          useValue: {
            publish: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    sessionRepository = module.get(getRepositoryToken(Session));
    userRepository = module.get(getRepositoryToken(User));
    jwtService = module.get(JwtService);
    eventPublisher = module.get(EventPublisher);

    // Setup default mocks
    jwtService.sign.mockImplementation((payload: any) => {
      return `mock-token-${payload.sub || 'unknown'}`;
    });
  });

  describe('createSession', () => {
    it('should create a new session successfully', async () => {
      // Arrange
      userRepository.findOneBy.mockResolvedValue(mockUser);
      const mockSession = {
        id: 'session-123',
        userId: mockUser.id,
        deviceInfo: mockDeviceInfo,
        ipAddress: '192.168.1.1',
        userAgent: mockDeviceInfo.userAgent,
        isActive: true,
        createdAt: new Date(),
        lastActivityAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      } as Session;

      sessionRepository.create.mockReturnValue(mockSession);
      sessionRepository.save.mockResolvedValue(mockSession);

      // Act
      const result = await service.createSession(mockUser.id, mockDeviceInfo, '192.168.1.1');

      // Assert
      expect(userRepository.findOneBy).toHaveBeenCalledWith({ id: mockUser.id });
      expect(sessionRepository.create).toHaveBeenCalled();
      expect(sessionRepository.save).toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalledWith('user.session.created', expect.any(Object));
      expect(result.session).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw NotFoundException when user does not exist', async () => {
      // Arrange
      userRepository.findOneBy.mockResolvedValue(null);

      // Act & Assert
      await expect(service.createSession('non-existent-user', mockDeviceInfo, '192.168.1.1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getActiveSessions', () => {
    it('should return active sessions for user', async () => {
      // Arrange
      const mockSessions = [
        {
          id: 'session-1',
          userId: mockUser.id,
          deviceInfo: mockDeviceInfo,
          ipAddress: '192.168.1.1',
          createdAt: new Date(),
          lastActivityAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          isActive: true,
        },
        {
          id: 'session-2',
          userId: mockUser.id,
          deviceInfo: mockDeviceInfo,
          ipAddress: '192.168.1.2',
          createdAt: new Date(),
          lastActivityAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          isActive: true,
        },
      ] as Session[];

      sessionRepository.find.mockResolvedValue(mockSessions);

      // Act
      const result = await service.getActiveSessions(mockUser.id);

      // Assert
      expect(sessionRepository.find).toHaveBeenCalledWith({
        where: { userId: mockUser.id, isActive: true },
        order: { lastActivityAt: 'DESC' },
      });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('session-1');
    });
  });

  describe('terminateSession', () => {
    it('should terminate session successfully', async () => {
      // Arrange
      const mockSession = {
        id: 'session-123',
        userId: mockUser.id,
        isActive: true,
      } as Session;

      sessionRepository.findOneBy.mockResolvedValue(mockSession);
      sessionRepository.save.mockResolvedValue(mockSession);

      // Act
      await service.terminateSession('session-123');

      // Assert
      expect(sessionRepository.findOneBy).toHaveBeenCalledWith({ id: 'session-123' });
      expect(sessionRepository.save).toHaveBeenCalled();
      expect(mockSession.isActive).toBe(false);
      expect(mockSession.terminatedReason).toBe('user_logout');
    });

    it('should throw NotFoundException when session not found', async () => {
      // Arrange
      sessionRepository.findOneBy.mockResolvedValue(null);

      // Act & Assert
      await expect(service.terminateSession('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateSession', () => {
    it('should validate session and return session data', async () => {
      // Arrange
      const mockSession = {
        id: 'session-123',
        userId: mockUser.id,
        isActive: true,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        lastActivityAt: new Date(),
        deviceInfo: mockDeviceInfo,
        ipAddress: '192.168.1.1',
        createdAt: new Date(),
      } as Session;

      sessionRepository.findOneBy.mockResolvedValue(mockSession);
      sessionRepository.save.mockResolvedValue(mockSession);

      // Act
      const result = await service.validateSession('session-123');

      // Assert
      expect(sessionRepository.findOneBy).toHaveBeenCalledWith({
        id: 'session-123',
        isActive: true,
      });
      expect(sessionRepository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result?.id).toBe('session-123');
    });

    it('should return null for expired session', async () => {
      // Arrange
      const expiredSession = {
        id: 'session-123',
        userId: mockUser.id,
        isActive: true,
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      } as Session;

      sessionRepository.findOneBy.mockResolvedValue(expiredSession);

      // Act
      const result = await service.validateSession('session-123');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should cleanup expired sessions', async () => {
      // Arrange
      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 5 }),
      };
      sessionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      // Act
      await service.cleanupExpiredSessions();

      // Assert
      expect(sessionRepository.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.update).toHaveBeenCalled();
      expect(mockQueryBuilder.set).toHaveBeenCalledWith({
        isActive: false,
        terminatedReason: 'expired',
        terminatedAt: expect.any(Date),
      });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('expiresAt < :now AND isActive = true', {
        now: expect.any(Date),
      });
      expect(mockQueryBuilder.execute).toHaveBeenCalled();
    });
  });
});
