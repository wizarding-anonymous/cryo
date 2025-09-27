import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProgressService } from './progress.service';
import { AchievementService } from './achievement.service';
import { UserProgress, Achievement } from '../entities';
import { AchievementType, AchievementCondition } from '../entities/achievement.entity';
import { EventType } from '../dto/update-progress.dto';

describe('ProgressService', () => {
  let service: ProgressService;
  let progressRepository: jest.Mocked<Repository<UserProgress>>;
  let achievementRepository: jest.Mocked<Repository<Achievement>>;
  let achievementService: jest.Mocked<AchievementService>;

  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockAchievementId = '123e4567-e89b-12d3-a456-426614174001';

  const mockAchievement: Achievement = {
    id: mockAchievementId,
    name: 'Первая покупка',
    description: 'Купите свою первую игру',
    type: AchievementType.FIRST_PURCHASE,
    condition: { type: 'first_time', field: 'gamesPurchased' } as AchievementCondition,
    iconUrl: 'icon.png',
    points: 10,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    userAchievements: [],
  };

  const mockProgress: UserProgress = {
    id: '123e4567-e89b-12d3-a456-426614174002',
    userId: mockUserId,
    achievementId: mockAchievementId,
    currentValue: 1,
    targetValue: 1,
    updatedAt: new Date(),
    achievement: mockAchievement,
  };

  beforeEach(async () => {
    const mockProgressRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockAchievementRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const mockAchievementService = {
      isAchievementUnlocked: jest.fn(),
      unlockAchievement: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgressService,
        {
          provide: getRepositoryToken(UserProgress),
          useValue: mockProgressRepository,
        },
        {
          provide: getRepositoryToken(Achievement),
          useValue: mockAchievementRepository,
        },
        {
          provide: AchievementService,
          useValue: mockAchievementService,
        },
      ],
    }).compile();

    service = module.get<ProgressService>(ProgressService);
    progressRepository = module.get(getRepositoryToken(UserProgress));
    achievementRepository = module.get(getRepositoryToken(Achievement));
    achievementService = module.get(AchievementService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateProgress', () => {
    it('should update progress for game purchase event', async () => {
      const eventData = { gameId: 'game-123', price: 1999 };

      achievementRepository.find.mockResolvedValue([mockAchievement]);
      progressRepository.find.mockResolvedValue([]);
      progressRepository.create.mockReturnValue(mockProgress);
      progressRepository.save.mockResolvedValue(mockProgress);
      achievementService.isAchievementUnlocked.mockResolvedValue(false);

      const result = await service.updateProgress(mockUserId, EventType.GAME_PURCHASE, eventData);

      expect(result).toHaveLength(1);
      expect(progressRepository.save).toHaveBeenCalled();
    });

    it('should handle review created event', async () => {
      const reviewAchievement: Achievement = {
        ...mockAchievement,
        id: 'review-achievement-id',
        name: 'Первый отзыв',
        type: AchievementType.FIRST_REVIEW,
        condition: { type: 'first_time', field: 'reviewsWritten' } as AchievementCondition,
      };

      const eventData = { reviewId: 'review-123', gameId: 'game-123' };

      achievementRepository.find.mockResolvedValue([reviewAchievement]);
      progressRepository.find.mockResolvedValue([]);
      progressRepository.create.mockReturnValue({
        ...mockProgress,
        achievementId: reviewAchievement.id,
      });
      progressRepository.save.mockResolvedValue({
        ...mockProgress,
        achievementId: reviewAchievement.id,
      });
      achievementService.isAchievementUnlocked.mockResolvedValue(false);

      const result = await service.updateProgress(mockUserId, EventType.REVIEW_CREATED, eventData);

      expect(result).toHaveLength(1);
      expect(progressRepository.save).toHaveBeenCalled();
    });

    it('should handle friend added event', async () => {
      const friendAchievement: Achievement = {
        ...mockAchievement,
        id: 'friend-achievement-id',
        name: 'Первый друг',
        type: AchievementType.FIRST_FRIEND,
        condition: { type: 'first_time', field: 'friendsAdded' } as AchievementCondition,
      };

      const eventData = { friendId: 'friend-123' };

      achievementRepository.find.mockResolvedValue([friendAchievement]);
      progressRepository.find.mockResolvedValue([]);
      progressRepository.create.mockReturnValue({
        ...mockProgress,
        achievementId: friendAchievement.id,
      });
      progressRepository.save.mockResolvedValue({
        ...mockProgress,
        achievementId: friendAchievement.id,
      });
      achievementService.isAchievementUnlocked.mockResolvedValue(false);

      const result = await service.updateProgress(mockUserId, EventType.FRIEND_ADDED, eventData);

      expect(result).toHaveLength(1);
      expect(progressRepository.save).toHaveBeenCalled();
    });

    it('should skip irrelevant achievements for event type', async () => {
      const reviewAchievement: Achievement = {
        ...mockAchievement,
        type: AchievementType.FIRST_REVIEW,
      };

      achievementRepository.find.mockResolvedValue([reviewAchievement]);
      progressRepository.find.mockResolvedValue([]);

      // Отправляем событие покупки игры, но достижение для отзывов
      const result = await service.updateProgress(mockUserId, EventType.GAME_PURCHASE, {});

      expect(result).toHaveLength(0);
      expect(progressRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('getUserProgress', () => {
    it('should return user progress sorted by updatedAt', async () => {
      const progressRecords = [
        {
          ...mockProgress,
          updatedAt: new Date('2024-01-15T10:00:00Z'),
        },
        {
          ...mockProgress,
          id: 'progress-2',
          updatedAt: new Date('2024-01-15T11:00:00Z'),
        },
      ];

      progressRepository.find.mockResolvedValue(progressRecords);

      const result = await service.getUserProgress(mockUserId);

      expect(result).toHaveLength(2);
      expect(progressRepository.find).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        relations: ['achievement'],
        order: { updatedAt: 'DESC' },
      });

      // Проверяем, что возвращается UserProgressResponseDto с вычисленным progressPercentage
      expect(result[0]).toHaveProperty('progressPercentage');
      expect(result[0].progressPercentage).toBe(100); // 1/1 * 100 = 100%
    });

    it('should return empty array when no progress found', async () => {
      progressRepository.find.mockResolvedValue([]);

      const result = await service.getUserProgress(mockUserId);

      expect(result).toHaveLength(0);
    });
  });

  describe('checkAchievements', () => {
    it('should unlock achievement when condition is met', async () => {
      const mockUserAchievement = {
        id: 'user-achievement-id',
        userId: mockUserId,
        achievementId: mockAchievementId,
        achievement: mockAchievement,
        unlockedAt: new Date(),
      };

      progressRepository.find.mockResolvedValue([mockProgress]);
      achievementService.isAchievementUnlocked.mockResolvedValue(false);
      achievementService.unlockAchievement.mockResolvedValue(mockUserAchievement as any);

      const result = await service.checkAchievements(mockUserId);

      expect(result).toHaveLength(1);
      expect(achievementService.unlockAchievement).toHaveBeenCalledWith(
        mockUserId,
        mockAchievementId,
      );
    });

    it('should skip already unlocked achievements', async () => {
      progressRepository.find.mockResolvedValue([mockProgress]);
      achievementService.isAchievementUnlocked.mockResolvedValue(true);

      const result = await service.checkAchievements(mockUserId);

      expect(result).toHaveLength(0);
      expect(achievementService.unlockAchievement).not.toHaveBeenCalled();
    });

    it('should handle unlock errors gracefully', async () => {
      progressRepository.find.mockResolvedValue([mockProgress]);
      achievementService.isAchievementUnlocked.mockResolvedValue(false);
      achievementService.unlockAchievement.mockRejectedValue(new Error('Already unlocked'));

      const result = await service.checkAchievements(mockUserId);

      expect(result).toHaveLength(0);
      // Должен продолжить работу несмотря на ошибку
    });
  });

  describe('evaluateCondition', () => {
    it('should evaluate first_time condition correctly', async () => {
      const condition: AchievementCondition = {
        type: 'first_time',
        field: 'gamesPurchased',
      };

      const userStats = {
        gamesPurchased: 1,
        reviewsWritten: 0,
        friendsAdded: 0,
      };

      // Используем рефлексию для доступа к приватному методу
      const result = await (service as any).evaluateCondition(condition, userStats);

      expect(result).toBe(true);
    });

    it('should evaluate first_time condition for all field types', async () => {
      const evaluateCondition = (service as any).evaluateCondition.bind(service);

      // Test gamesPurchased
      let result = await evaluateCondition(
        { type: 'first_time', field: 'gamesPurchased' },
        { gamesPurchased: 1, reviewsWritten: 0, friendsAdded: 0 },
      );
      expect(result).toBe(true);

      // Test reviewsWritten
      result = await evaluateCondition(
        { type: 'first_time', field: 'reviewsWritten' },
        { gamesPurchased: 0, reviewsWritten: 1, friendsAdded: 0 },
      );
      expect(result).toBe(true);

      // Test friendsAdded
      result = await evaluateCondition(
        { type: 'first_time', field: 'friendsAdded' },
        { gamesPurchased: 0, reviewsWritten: 0, friendsAdded: 1 },
      );
      expect(result).toBe(true);

      // Test unknown field
      result = await evaluateCondition(
        { type: 'first_time', field: 'unknownField' },
        { gamesPurchased: 1, reviewsWritten: 0, friendsAdded: 0 },
      );
      expect(result).toBe(false);
    });

    it('should evaluate count condition correctly', async () => {
      const condition: AchievementCondition = {
        type: 'count',
        field: 'gamesPurchased',
        target: 5,
      };

      const userStats = {
        gamesPurchased: 3,
        reviewsWritten: 0,
        friendsAdded: 0,
      };

      const result = await (service as any).evaluateCondition(condition, userStats);

      expect(result).toBe(false);

      // Тест с достижением цели
      userStats.gamesPurchased = 5;
      const result2 = await (service as any).evaluateCondition(condition, userStats);
      expect(result2).toBe(true);
    });

    it('should handle count condition with missing target or field', async () => {
      const evaluateCondition = (service as any).evaluateCondition.bind(service);

      // Missing target
      let result = await evaluateCondition(
        { type: 'count', field: 'gamesPurchased' },
        { gamesPurchased: 5, reviewsWritten: 0, friendsAdded: 0 },
      );
      expect(result).toBe(false);

      // Missing field
      result = await evaluateCondition(
        { type: 'count', target: 5 },
        { gamesPurchased: 5, reviewsWritten: 0, friendsAdded: 0 },
      );
      expect(result).toBe(false);
    });

    it('should evaluate threshold condition correctly', async () => {
      const condition: AchievementCondition = {
        type: 'threshold',
        field: 'reviewsWritten',
        target: 10,
      };

      const userStats = {
        gamesPurchased: 0,
        reviewsWritten: 15,
        friendsAdded: 0,
      };

      const result = await (service as any).evaluateCondition(condition, userStats);

      expect(result).toBe(true);
    });

    it('should handle threshold condition with missing target or field', async () => {
      const evaluateCondition = (service as any).evaluateCondition.bind(service);

      // Missing target
      let result = await evaluateCondition(
        { type: 'threshold', field: 'reviewsWritten' },
        { gamesPurchased: 0, reviewsWritten: 15, friendsAdded: 0 },
      );
      expect(result).toBe(false);

      // Missing field
      result = await evaluateCondition(
        { type: 'threshold', target: 10 },
        { gamesPurchased: 0, reviewsWritten: 15, friendsAdded: 0 },
      );
      expect(result).toBe(false);
    });

    it('should return false for unknown condition type', async () => {
      const condition = {
        type: 'unknown',
        field: 'gamesPurchased',
      } as any;

      const userStats = {
        gamesPurchased: 1,
        reviewsWritten: 0,
        friendsAdded: 0,
      };

      const result = await (service as any).evaluateCondition(condition, userStats);

      expect(result).toBe(false);
    });
  });

  describe('isEventRelevantForAchievement', () => {
    it('should correctly identify relevant events for achievements', () => {
      // Тестируем приватный метод через рефлексию
      const isRelevant = (service as any).isEventRelevantForAchievement.bind(service);

      expect(isRelevant(EventType.GAME_PURCHASE, AchievementType.FIRST_PURCHASE)).toBe(true);
      expect(isRelevant(EventType.GAME_PURCHASE, AchievementType.GAMES_PURCHASED)).toBe(true);
      expect(isRelevant(EventType.GAME_PURCHASE, AchievementType.FIRST_REVIEW)).toBe(false);

      expect(isRelevant(EventType.REVIEW_CREATED, AchievementType.FIRST_REVIEW)).toBe(true);
      expect(isRelevant(EventType.REVIEW_CREATED, AchievementType.REVIEWS_WRITTEN)).toBe(true);
      expect(isRelevant(EventType.REVIEW_CREATED, AchievementType.FIRST_PURCHASE)).toBe(false);

      expect(isRelevant(EventType.FRIEND_ADDED, AchievementType.FIRST_FRIEND)).toBe(true);
      expect(isRelevant(EventType.FRIEND_ADDED, AchievementType.FIRST_PURCHASE)).toBe(false);
    });
  });

  describe('calculateProgressValue', () => {
    it('should calculate correct progress values for different achievement types', () => {
      const userStats = {
        gamesPurchased: 3,
        reviewsWritten: 5,
        friendsAdded: 2,
      };

      const calculateValue = (service as any).calculateProgressValue.bind(service);

      expect(calculateValue({ type: AchievementType.FIRST_PURCHASE }, userStats)).toBe(3);
      expect(calculateValue({ type: AchievementType.GAMES_PURCHASED }, userStats)).toBe(3);
      expect(calculateValue({ type: AchievementType.FIRST_REVIEW }, userStats)).toBe(5);
      expect(calculateValue({ type: AchievementType.REVIEWS_WRITTEN }, userStats)).toBe(5);
      expect(calculateValue({ type: AchievementType.FIRST_FRIEND }, userStats)).toBe(2);
    });

    it('should return 0 for unknown achievement types', () => {
      const userStats = {
        gamesPurchased: 3,
        reviewsWritten: 5,
        friendsAdded: 2,
      };

      const calculateValue = (service as any).calculateProgressValue.bind(service);

      expect(calculateValue({ type: 'UNKNOWN_TYPE' as any }, userStats)).toBe(0);
    });
  });

  describe('calculateTargetValue', () => {
    it('should calculate correct target values', () => {
      const calculateTarget = (service as any).calculateTargetValue.bind(service);

      // Достижение с указанной целью
      const achievementWithTarget = {
        condition: { type: 'count', target: 10 },
      };
      expect(calculateTarget(achievementWithTarget)).toBe(10);

      // Достижение "первый раз"
      const firstTimeAchievement = {
        condition: { type: 'first_time' },
      };
      expect(calculateTarget(firstTimeAchievement)).toBe(1);

      // Достижение без цели
      const achievementWithoutTarget = {
        condition: { type: 'count' },
      };
      expect(calculateTarget(achievementWithoutTarget)).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should handle database errors in updateProgress', async () => {
      const eventData = { gameId: 'game-123', price: 1999 };

      achievementRepository.find.mockRejectedValue(new Error('Database error'));

      await expect(
        service.updateProgress(mockUserId, EventType.GAME_PURCHASE, eventData),
      ).rejects.toThrow('Database error');
    });

    it('should handle save errors gracefully', async () => {
      const eventData = { gameId: 'game-123', price: 1999 };

      achievementRepository.find.mockResolvedValue([mockAchievement]);
      progressRepository.find.mockResolvedValue([]); // Для getUserStats
      progressRepository.findOne.mockResolvedValue(null);
      progressRepository.create.mockReturnValue(mockProgress);
      progressRepository.save.mockRejectedValue(new Error('Save error'));
      achievementService.isAchievementUnlocked.mockResolvedValue(false);

      // Метод должен вернуть пустой массив, так как ошибка обрабатывается внутри updateAchievementProgress
      const result = await service.updateProgress(mockUserId, EventType.GAME_PURCHASE, eventData);
      expect(result).toEqual([]);
    });

    it('should handle getUserProgress database errors', async () => {
      progressRepository.find.mockRejectedValue(new Error('Database error'));

      await expect(service.getUserProgress(mockUserId)).rejects.toThrow('Database error');
    });
  });

  describe('edge cases', () => {
    it('should handle empty event data', async () => {
      achievementRepository.find.mockResolvedValue([mockAchievement]);
      progressRepository.find.mockResolvedValue([]);

      const result = await service.updateProgress(mockUserId, EventType.GAME_PURCHASE, {});

      expect(result).toHaveLength(0);
    });

    it('should handle invalid event type', async () => {
      achievementRepository.find.mockResolvedValue([mockAchievement]);
      progressRepository.find.mockResolvedValue([]);

      const result = await service.updateProgress(mockUserId, 'invalid_event' as EventType, {});

      expect(result).toHaveLength(0);
    });

    it('should handle existing progress update', async () => {
      const eventData = { gameId: 'game-123', price: 1999 };
      const existingProgress = {
        ...mockProgress,
        currentValue: 0,
      };

      achievementRepository.find.mockResolvedValue([mockAchievement]);
      progressRepository.find.mockResolvedValue([]); // Для getUserStats
      progressRepository.findOne.mockResolvedValue(existingProgress); // Для updateAchievementProgress
      progressRepository.save.mockResolvedValue({
        ...existingProgress,
        currentValue: 1,
      });
      achievementService.isAchievementUnlocked.mockResolvedValue(false);

      const result = await service.updateProgress(mockUserId, EventType.GAME_PURCHASE, eventData);

      expect(result).toHaveLength(1);
      expect(progressRepository.save).toHaveBeenCalledWith({
        ...existingProgress,
        currentValue: 1,
      });
    });

    it('should skip already unlocked achievements in checkAchievements', async () => {
      progressRepository.find.mockResolvedValue([mockProgress]);
      achievementService.isAchievementUnlocked.mockResolvedValue(true);

      const result = await service.checkAchievements(mockUserId);

      expect(result).toHaveLength(0);
      expect(achievementService.unlockAchievement).not.toHaveBeenCalled();
    });

    it('should handle progress with incomplete conditions', async () => {
      const incompleteProgress = {
        ...mockProgress,
        currentValue: 0,
        targetValue: 5,
      };

      progressRepository.find.mockResolvedValue([incompleteProgress]);
      achievementService.isAchievementUnlocked.mockResolvedValue(false);

      const result = await service.checkAchievements(mockUserId);

      expect(result).toHaveLength(0);
      expect(achievementService.unlockAchievement).not.toHaveBeenCalled();
    });
  });

  describe('getAchievementById', () => {
    it('should return achievement when found', async () => {
      achievementRepository.findOne.mockResolvedValue(mockAchievement);

      const result = await service.getAchievementById(mockAchievementId);

      expect(result).toEqual(mockAchievement);
      expect(achievementRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockAchievementId },
      });
    });

    it('should return null when achievement not found', async () => {
      achievementRepository.findOne.mockResolvedValue(null);

      const result = await service.getAchievementById(mockAchievementId);

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      achievementRepository.findOne.mockRejectedValue(new Error('Database error'));

      const result = await service.getAchievementById(mockAchievementId);

      expect(result).toBeNull();
    });
  });

  describe('getUserStats', () => {
    it('should calculate user stats correctly', async () => {
      const getUserStats = (service as any).getUserStats.bind(service);
      const eventData = {
        gamesPurchased: 5,
        reviewsWritten: 3,
        friendsAdded: 2,
      };

      // Настраиваем мок для возврата массива прогресса
      const mockProgressRecords = [
        {
          ...mockProgress,
          currentValue: 5,
          achievement: { ...mockAchievement, type: AchievementType.GAMES_PURCHASED },
        },
        {
          ...mockProgress,
          currentValue: 3,
          achievement: { ...mockAchievement, type: AchievementType.REVIEWS_WRITTEN },
        },
        {
          ...mockProgress,
          currentValue: 2,
          achievement: { ...mockAchievement, type: AchievementType.FIRST_FRIEND },
        },
      ];
      progressRepository.find.mockResolvedValue(mockProgressRecords);

      const stats = await getUserStats(mockUserId, eventData);

      expect(stats).toEqual({
        gamesPurchased: 5,
        reviewsWritten: 3,
        friendsAdded: 2,
      });
    });

    it('should handle missing event data fields', async () => {
      const getUserStats = (service as any).getUserStats.bind(service);
      const eventData = {
        gamesPurchased: 5,
      };

      // Настраиваем мок для возврата только одного типа прогресса
      const mockProgressRecords = [
        {
          ...mockProgress,
          currentValue: 5,
          achievement: { ...mockAchievement, type: AchievementType.GAMES_PURCHASED },
        },
      ];
      progressRepository.find.mockResolvedValue(mockProgressRecords);

      const stats = await getUserStats(mockUserId, eventData);

      expect(stats).toEqual({
        gamesPurchased: 5,
        reviewsWritten: 0,
        friendsAdded: 0,
      });
    });

    it('should handle getUserStats with event type and data', async () => {
      const getUserStats = (service as any).getUserStats.bind(service);

      progressRepository.find.mockResolvedValue([]);

      const stats1 = await getUserStats(mockUserId, EventType.GAME_PURCHASE, { gameId: 'game-1' });
      expect(stats1.gamesPurchased).toBe(1);
      expect(stats1.firstPurchaseDate).toBeInstanceOf(Date);

      const stats2 = await getUserStats(mockUserId, EventType.REVIEW_CREATED, {
        reviewId: 'review-1',
      });
      expect(stats2.reviewsWritten).toBe(1);
      expect(stats2.firstReviewDate).toBeInstanceOf(Date);

      const stats3 = await getUserStats(mockUserId, EventType.FRIEND_ADDED, {
        friendId: 'friend-1',
      });
      expect(stats3.friendsAdded).toBe(1);
      expect(stats3.firstFriendDate).toBeInstanceOf(Date);
    });

    it('should handle getUserStats without event type', async () => {
      const getUserStats = (service as any).getUserStats.bind(service);

      progressRepository.find.mockResolvedValue([]);

      const stats = await getUserStats(mockUserId);
      expect(stats).toEqual({
        gamesPurchased: 0,
        reviewsWritten: 0,
        friendsAdded: 0,
      });
    });
  });

  describe('updateAchievementProgress', () => {
    it('should create new progress record when none exists', async () => {
      const updateAchievementProgress = (service as any).updateAchievementProgress.bind(service);
      const userStats = {
        gamesPurchased: 1,
        reviewsWritten: 0,
        friendsAdded: 0,
      };

      progressRepository.findOne.mockResolvedValue(null);
      progressRepository.create.mockReturnValue(mockProgress);
      progressRepository.save.mockResolvedValue(mockProgress);

      const result = await updateAchievementProgress(mockUserId, mockAchievement, userStats);

      expect(result).toEqual(mockProgress);
      expect(progressRepository.create).toHaveBeenCalledWith({
        userId: mockUserId,
        achievementId: mockAchievementId,
        currentValue: 1,
        targetValue: 1,
      });
    });

    it('should update existing progress record', async () => {
      const updateAchievementProgress = (service as any).updateAchievementProgress.bind(service);
      const userStats = {
        gamesPurchased: 2,
        reviewsWritten: 0,
        friendsAdded: 0,
      };

      const existingProgress = {
        ...mockProgress,
        currentValue: 1,
      };

      progressRepository.findOne.mockResolvedValue(existingProgress);
      progressRepository.save.mockResolvedValue({
        ...existingProgress,
        currentValue: 2,
      });

      const result = await updateAchievementProgress(mockUserId, mockAchievement, userStats);

      expect(result.currentValue).toBe(2);
      expect(progressRepository.save).toHaveBeenCalled();
    });

    it('should handle save errors gracefully', async () => {
      const updateAchievementProgress = (service as any).updateAchievementProgress.bind(service);
      const userStats = {
        gamesPurchased: 1,
        reviewsWritten: 0,
        friendsAdded: 0,
      };

      progressRepository.findOne.mockResolvedValue(null);
      progressRepository.create.mockReturnValue(mockProgress);
      progressRepository.save.mockRejectedValue(new Error('Save error'));

      const result = await updateAchievementProgress(mockUserId, mockAchievement, userStats);

      expect(result).toBeNull();
    });
  });
});
