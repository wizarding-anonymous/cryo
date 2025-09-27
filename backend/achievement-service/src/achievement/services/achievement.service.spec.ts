import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Repository } from 'typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { AchievementService } from './achievement.service';
import { Achievement, UserAchievement } from '../entities';
import { AchievementType } from '../entities/achievement.entity';

describe('AchievementService', () => {
  let service: AchievementService;
  let achievementRepository: jest.Mocked<Repository<Achievement>>;
  let userAchievementRepository: jest.Mocked<Repository<UserAchievement>>;
  let cacheManager: jest.Mocked<any>;

  const mockAchievement: Achievement = {
    id: '123e4567-e89b-12d3-a456-426614174001',
    name: 'Первая покупка',
    description: 'Поздравляем с первой покупкой игры на платформе!',
    type: AchievementType.FIRST_PURCHASE,
    condition: { type: 'first_time' },
    iconUrl: 'https://example.com/icons/first-purchase.png',
    points: 100,
    isActive: true,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    userAchievements: [],
  };

  const mockUserAchievement: UserAchievement = {
    id: '123e4567-e89b-12d3-a456-426614174003',
    userId: '123e4567-e89b-12d3-a456-426614174000',
    achievementId: '123e4567-e89b-12d3-a456-426614174001',
    unlockedAt: new Date('2024-01-15T10:30:00.000Z'),
    achievement: mockAchievement,
  };

  beforeEach(async () => {
    const mockAchievementRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockUserAchievementRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
      getRawMany: jest.fn(),
      getCount: jest.fn(),
      getMany: jest.fn(),
    };

    const mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AchievementService,
        {
          provide: getRepositoryToken(Achievement),
          useValue: mockAchievementRepository,
        },
        {
          provide: getRepositoryToken(UserAchievement),
          useValue: mockUserAchievementRepository,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<AchievementService>(AchievementService);
    achievementRepository = module.get(getRepositoryToken(Achievement));
    userAchievementRepository = module.get(getRepositoryToken(UserAchievement));
    cacheManager = module.get(CACHE_MANAGER);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllAchievements', () => {
    it('should return cached achievements if available', async () => {
      const cachedAchievements = [mockAchievement];
      cacheManager.get.mockResolvedValue(cachedAchievements);

      const result = await service.getAllAchievements();

      expect(cacheManager.get).toHaveBeenCalledWith('achievements:all');
      expect(result).toEqual(cachedAchievements);
      expect(achievementRepository.find).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache if not in cache', async () => {
      cacheManager.get.mockResolvedValue(null);
      achievementRepository.find.mockResolvedValue([mockAchievement]);

      const result = await service.getAllAchievements();

      expect(cacheManager.get).toHaveBeenCalledWith('achievements:all');
      expect(achievementRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { createdAt: 'ASC' },
      });
      expect(cacheManager.set).toHaveBeenCalledWith('achievements:all', expect.any(Array), 300);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockAchievement.id);
    });
  });

  describe('getUserAchievements', () => {
    it('should return cached user achievements if available', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const cachedResult = {
        achievements: [mockUserAchievement],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      cacheManager.get.mockResolvedValue(cachedResult);

      const result = await service.getUserAchievements(userId);

      expect(cacheManager.get).toHaveBeenCalledWith(`user:${userId}:achievements:{}`);
      expect(result).toEqual(cachedResult);
    });

    it('should fetch from database with pagination', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      cacheManager.get.mockResolvedValue(null);

      const mockQueryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        getMany: jest.fn().mockResolvedValue([mockUserAchievement]),
      } as any;

      userAchievementRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getUserAchievements(userId, { page: 1, limit: 10 });

      expect(userAchievementRepository.createQueryBuilder).toHaveBeenCalledWith('ua');
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'ua.achievement',
        'achievement',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('ua.userId = :userId', { userId });
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it('should apply type filter when provided', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      cacheManager.get.mockResolvedValue(null);

      const mockQueryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        getMany: jest.fn().mockResolvedValue([mockUserAchievement]),
      } as any;

      userAchievementRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getUserAchievements(userId, {
        page: 1,
        limit: 10,
        type: 'first_purchase',
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('achievement.type = :type', {
        type: 'first_purchase',
      });
    });

    it('should filter unlocked achievements when unlocked=true', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      cacheManager.get.mockResolvedValue(null);

      const mockQueryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        getMany: jest.fn().mockResolvedValue([mockUserAchievement]),
      } as any;

      userAchievementRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getUserAchievements(userId, {
        page: 1,
        limit: 10,
        unlocked: true,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('ua.id IS NOT NULL');
    });

    it('should filter locked achievements when unlocked=false', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      cacheManager.get.mockResolvedValue(null);

      // Mock for getting unlocked achievement IDs
      const unlockedQueryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ ua_achievementId: 'unlocked-id' }]),
      } as any;

      // Mock for getting all achievements excluding unlocked ones
      const allAchievementsQueryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockAchievement]),
        getCount: jest.fn().mockResolvedValue(1),
      } as any;

      userAchievementRepository.createQueryBuilder.mockReturnValue(unlockedQueryBuilder);
      achievementRepository.createQueryBuilder.mockReturnValue(allAchievementsQueryBuilder);

      const result = await service.getUserAchievements(userId, {
        page: 1,
        limit: 10,
        unlocked: false,
      });

      expect(unlockedQueryBuilder.getRawMany).toHaveBeenCalled();
      expect(allAchievementsQueryBuilder.andWhere).toHaveBeenCalledWith(
        'achievement.id NOT IN (:...unlockedIds)',
        { unlockedIds: ['unlocked-id'] },
      );
      expect(result.achievements).toHaveLength(1);
    });

    it('should handle locked achievements when no achievements are unlocked', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      cacheManager.get.mockResolvedValue(null);

      // Mock for getting unlocked achievement IDs (empty)
      const unlockedQueryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      } as any;

      // Mock for getting all achievements
      const allAchievementsQueryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockAchievement]),
        getCount: jest.fn().mockResolvedValue(1),
      } as any;

      userAchievementRepository.createQueryBuilder.mockReturnValue(unlockedQueryBuilder);
      achievementRepository.createQueryBuilder.mockReturnValue(allAchievementsQueryBuilder);

      const result = await service.getUserAchievements(userId, {
        page: 1,
        limit: 10,
        unlocked: false,
      });

      expect(allAchievementsQueryBuilder.andWhere).toHaveBeenCalledWith('1=1', { unlockedIds: [] });
    });

    it('should handle empty results', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      cacheManager.get.mockResolvedValue(null);

      const mockQueryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      } as any;

      userAchievementRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getUserAchievements(userId);

      expect(result.total).toBe(0);
      expect(result.achievements).toEqual([]);
      expect(result.totalPages).toBe(0);
    });
  });

  describe('unlockAchievement', () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000';
    const achievementId = '123e4567-e89b-12d3-a456-426614174001';

    it('should throw NotFoundException if achievement does not exist', async () => {
      achievementRepository.findOne.mockResolvedValue(null);

      await expect(service.unlockAchievement(userId, achievementId)).rejects.toThrow(
        NotFoundException,
      );
      expect(achievementRepository.findOne).toHaveBeenCalledWith({
        where: { id: achievementId, isActive: true },
      });
    });

    it('should throw ConflictException if achievement is already unlocked', async () => {
      achievementRepository.findOne.mockResolvedValue(mockAchievement);
      userAchievementRepository.findOne.mockResolvedValue(mockUserAchievement);

      await expect(service.unlockAchievement(userId, achievementId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should successfully unlock achievement', async () => {
      achievementRepository.findOne.mockResolvedValue(mockAchievement);
      userAchievementRepository.findOne
        .mockResolvedValueOnce(null) // First call for checking existing
        .mockResolvedValueOnce(mockUserAchievement); // Second call for getting full data
      userAchievementRepository.create.mockReturnValue(mockUserAchievement);
      userAchievementRepository.save.mockResolvedValue(mockUserAchievement);

      const result = await service.unlockAchievement(userId, achievementId);

      expect(userAchievementRepository.create).toHaveBeenCalledWith({
        userId,
        achievementId,
      });
      expect(userAchievementRepository.save).toHaveBeenCalledWith(mockUserAchievement);
      expect(result.id).toBe(mockUserAchievement.id);
      expect(result.userId).toBe(userId);
      expect(result.achievementId).toBe(achievementId);
    });

    it('should throw error if failed to retrieve saved user achievement', async () => {
      achievementRepository.findOne.mockResolvedValue(mockAchievement);
      userAchievementRepository.findOne
        .mockResolvedValueOnce(null) // First call for checking existing
        .mockResolvedValueOnce(null); // Second call returns null
      userAchievementRepository.create.mockReturnValue(mockUserAchievement);
      userAchievementRepository.save.mockResolvedValue(mockUserAchievement);

      await expect(service.unlockAchievement(userId, achievementId)).rejects.toThrow(
        'Failed to retrieve saved user achievement',
      );
    });
  });

  describe('isAchievementUnlocked', () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000';
    const achievementId = '123e4567-e89b-12d3-a456-426614174001';

    it('should return cached result if available', async () => {
      cacheManager.get.mockResolvedValue(true);

      const result = await service.isAchievementUnlocked(userId, achievementId);

      expect(cacheManager.get).toHaveBeenCalledWith(
        `user:${userId}:achievement:${achievementId}:unlocked`,
      );
      expect(result).toBe(true);
      expect(userAchievementRepository.findOne).not.toHaveBeenCalled();
    });

    it('should return true if achievement is unlocked', async () => {
      cacheManager.get.mockResolvedValue(undefined);
      userAchievementRepository.findOne.mockResolvedValue(mockUserAchievement);

      const result = await service.isAchievementUnlocked(userId, achievementId);

      expect(userAchievementRepository.findOne).toHaveBeenCalledWith({
        where: { userId, achievementId },
      });
      expect(cacheManager.set).toHaveBeenCalledWith(
        `user:${userId}:achievement:${achievementId}:unlocked`,
        true,
        300,
      );
      expect(result).toBe(true);
    });

    it('should return false if achievement is not unlocked', async () => {
      cacheManager.get.mockResolvedValue(undefined);
      userAchievementRepository.findOne.mockResolvedValue(null);

      const result = await service.isAchievementUnlocked(userId, achievementId);

      expect(result).toBe(false);
      expect(cacheManager.set).toHaveBeenCalledWith(
        `user:${userId}:achievement:${achievementId}:unlocked`,
        false,
        300,
      );
    });
  });

  describe('error handling', () => {
    it('should handle database errors in getAllAchievements', async () => {
      cacheManager.get.mockResolvedValue(null);
      achievementRepository.find.mockRejectedValue(new Error('Database error'));

      await expect(service.getAllAchievements()).rejects.toThrow('Database error');
    });

    it('should handle cache errors gracefully in getAllAchievements', async () => {
      cacheManager.get.mockRejectedValue(new Error('Cache error'));
      achievementRepository.find.mockResolvedValue([mockAchievement]);

      const result = await service.getAllAchievements();

      expect(result).toHaveLength(1);
      expect(achievementRepository.find).toHaveBeenCalled();
    });

    it('should handle cache set errors gracefully', async () => {
      cacheManager.get.mockResolvedValue(null);
      cacheManager.set.mockRejectedValue(new Error('Cache set error'));
      achievementRepository.find.mockResolvedValue([mockAchievement]);

      const result = await service.getAllAchievements();

      expect(result).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('should handle invalid pagination parameters', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      cacheManager.get.mockResolvedValue(null);

      const mockQueryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      } as any;

      userAchievementRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Test with negative page
      const result = await service.getUserAchievements(userId, { page: -1, limit: 10 });

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(result.page).toBe(1);
    });

    it('should handle large limit values', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      cacheManager.get.mockResolvedValue(null);

      const mockQueryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      } as any;

      userAchievementRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Test with large limit
      const result = await service.getUserAchievements(userId, { page: 1, limit: 1000 });

      expect(mockQueryBuilder.take).toHaveBeenCalledWith(100); // Should be capped at 100
      expect(result.limit).toBe(100);
    });
  });
});
