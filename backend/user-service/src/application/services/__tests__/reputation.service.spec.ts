import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { ReputationService } from '../reputation.service';
import { User } from '../../../domain/entities/user.entity';
import { ReputationEntry } from '../../../domain/entities/reputation-entry.entity';
import { EventPublisher } from '../../events/event-publisher.service';

describe('ReputationService', () => {
  let service: ReputationService;
  let userRepository: jest.Mocked<Repository<User>>;
  let reputationRepository: jest.Mocked<Repository<ReputationEntry>>;
  let eventPublisher: jest.Mocked<EventPublisher>;

  const mockUser: Partial<User> = {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    reputationScore: 100,
    isActive: true,
    isBlocked: false,
    emailVerified: false,
    phoneVerified: false,
    profile: {},
    privacySettings: {},
    notificationSettings: {},
    mfaEnabled: false,
    mfaMethods: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReputationService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOneBy: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ReputationEntry),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            createQueryBuilder: jest.fn(),
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

    service = module.get<ReputationService>(ReputationService);
    userRepository = module.get(getRepositoryToken(User));
    reputationRepository = module.get(getRepositoryToken(ReputationEntry));
    eventPublisher = module.get(EventPublisher);
  });

  describe('updateReputation', () => {
    it('should update user reputation successfully', async () => {
      userRepository.findOneBy.mockResolvedValue(mockUser as User);
      reputationRepository.create.mockReturnValue({} as ReputationEntry);
      reputationRepository.save.mockResolvedValue({} as ReputationEntry);
      userRepository.update.mockResolvedValue({} as any);
      eventPublisher.publish.mockResolvedValue();

      const reputationChange = {
        userId: 'user-1',
        change: 10,
        reason: 'Test reason',
        source: 'system' as const,
      };

      await service.updateReputation(reputationChange);

      expect(userRepository.findOneBy).toHaveBeenCalledWith({ id: 'user-1' });
      expect(reputationRepository.create).toHaveBeenCalled();
      expect(reputationRepository.save).toHaveBeenCalled();
      expect(userRepository.update).toHaveBeenCalledWith('user-1', { reputationScore: 110 });
      expect(eventPublisher.publish).toHaveBeenCalledWith('user.reputation.changed', expect.any(Object));
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepository.findOneBy.mockResolvedValue(null);

      const reputationChange = {
        userId: 'non-existent',
        change: 10,
        reason: 'Test reason',
        source: 'system' as const,
      };

      await expect(service.updateReputation(reputationChange)).rejects.toThrow(NotFoundException);
    });

    it('should not allow reputation to go below 0', async () => {
      const userWithLowReputation = { ...mockUser, reputationScore: 5 } as User;
      userRepository.findOneBy.mockResolvedValue(userWithLowReputation);
      reputationRepository.create.mockReturnValue({} as ReputationEntry);
      reputationRepository.save.mockResolvedValue({} as ReputationEntry);
      userRepository.update.mockResolvedValue({} as any);
      eventPublisher.publish.mockResolvedValue();

      const reputationChange = {
        userId: 'user-1',
        change: -10,
        reason: 'Penalty',
        source: 'admin_action' as const,
      };

      await service.updateReputation(reputationChange);

      expect(userRepository.update).toHaveBeenCalledWith('user-1', { reputationScore: 0 });
    });
  });

  describe('getUserReputation', () => {
    it('should return user reputation', async () => {
      userRepository.findOneBy.mockResolvedValue(mockUser as User);

      const reputation = await service.getUserReputation('user-1');

      expect(reputation).toBe(100);
      expect(userRepository.findOneBy).toHaveBeenCalledWith({ id: 'user-1' });
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepository.findOneBy.mockResolvedValue(null);

      await expect(service.getUserReputation('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserPrivileges', () => {
    it('should return correct privileges for low reputation user', async () => {
      const lowReputationUser = { ...mockUser, reputationScore: 50 } as User;
      userRepository.findOneBy.mockResolvedValue(lowReputationUser);

      const privileges = await service.getUserPrivileges('user-1');

      expect(privileges.canCreateGroups).toBe(false);
      expect(privileges.canModerateComments).toBe(false);
      expect(privileges.canAccessBetaFeatures).toBe(false);
      expect(privileges.maxFriendsLimit).toBe(100);
      expect(privileges.prioritySupport).toBe(false);
    });

    it('should return correct privileges for high reputation user', async () => {
      const highReputationUser = { ...mockUser, reputationScore: 2500 } as User;
      userRepository.findOneBy.mockResolvedValue(highReputationUser);

      const privileges = await service.getUserPrivileges('user-1');

      expect(privileges.canCreateGroups).toBe(true);
      expect(privileges.canModerateComments).toBe(true);
      expect(privileges.canAccessBetaFeatures).toBe(true);
      expect(privileges.canCreateCustomTags).toBe(true);
      expect(privileges.maxFriendsLimit).toBe(500);
      expect(privileges.prioritySupport).toBe(true);
    });
  });

  describe('awardForActivity', () => {
    beforeEach(() => {
      userRepository.findOneBy.mockResolvedValue(mockUser as User);
      reputationRepository.create.mockReturnValue({} as ReputationEntry);
      reputationRepository.save.mockResolvedValue({} as ReputationEntry);
      userRepository.update.mockResolvedValue({} as any);
      eventPublisher.publish.mockResolvedValue();
    });

    it('should award correct reputation for game review', async () => {
      await service.awardForActivity('user-1', 'game_review');

      expect(reputationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          change: 5,
          reason: 'Написание отзыва на игру',
          source: 'system',
        }),
      );
    });

    it('should award correct reputation for achievement unlock with rarity', async () => {
      await service.awardForActivity('user-1', 'achievement_unlock', { rarity: 'legendary' });

      expect(reputationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          change: 50,
          reason: 'Получение достижения (legendary)',
        }),
      );
    });

    it('should not award reputation for unknown activity', async () => {
      await service.awardForActivity('user-1', 'unknown_activity');

      expect(reputationRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('penalizeForViolation', () => {
    beforeEach(() => {
      userRepository.findOneBy.mockResolvedValue(mockUser as User);
      reputationRepository.create.mockReturnValue({} as ReputationEntry);
      reputationRepository.save.mockResolvedValue({} as ReputationEntry);
      userRepository.update.mockResolvedValue({} as any);
      eventPublisher.publish.mockResolvedValue();
    });

    it('should penalize correctly for spam violation', async () => {
      await service.penalizeForViolation('user-1', 'spam', 'major');

      expect(reputationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          change: -20, // -10 * 2 (major severity)
          reason: 'Спам (major)',
          source: 'admin_action',
        }),
      );
    });

    it('should penalize correctly for severe cheating', async () => {
      await service.penalizeForViolation('user-1', 'cheating', 'severe');

      expect(reputationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          change: -500, // -100 * 5 (severe severity)
          reason: 'Читерство (severe)',
        }),
      );
    });
  });

  describe('getReputationHistory', () => {
    it('should return reputation history', async () => {
      const mockHistory = [
        { id: '1', change: 10, reason: 'Test', createdAt: new Date() },
        { id: '2', change: -5, reason: 'Penalty', createdAt: new Date() },
      ] as ReputationEntry[];

      reputationRepository.find.mockResolvedValue(mockHistory);

      const history = await service.getReputationHistory('user-1', 10);

      expect(history).toEqual(mockHistory);
      expect(reputationRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { createdAt: 'DESC' },
        take: 10,
      });
    });
  });

  describe('getTopUsers', () => {
    it('should return top users by reputation', async () => {
      const mockUsers = [
        { id: 'user-1', username: 'user1', reputationScore: 1000 },
        { id: 'user-2', username: 'user2', reputationScore: 800 },
      ] as User[];

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockUsers),
      };

      userRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const topUsers = await service.getTopUsers(5);

      expect(topUsers).toEqual([
        { userId: 'user-1', username: 'user1', reputation: 1000 },
        { userId: 'user-2', username: 'user2', reputation: 800 },
      ]);
    });
  });
});
