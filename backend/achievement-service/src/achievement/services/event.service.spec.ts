import { Test, TestingModule } from '@nestjs/testing';
import { EventService } from './event.service';
import { ProgressService } from './progress.service';
import { NotificationService } from './notification.service';
import { LibraryService } from './library.service';
import { EventType } from '../dto/update-progress.dto';
import { UserProgressResponseDto, UserAchievementResponseDto } from '../dto';
import { AchievementType } from '../entities/achievement.entity';

describe('EventService', () => {
  let service: EventService;
  let progressService: jest.Mocked<ProgressService>;
  let notificationService: jest.Mocked<NotificationService>;
  let libraryService: jest.Mocked<LibraryService>;

  const mockUserProgress: UserProgressResponseDto = {
    id: 'progress-1',
    userId: 'user-1',
    achievementId: 'achievement-1',
    achievement: {
      id: 'achievement-1',
      name: 'Первая покупка',
      description: 'Купите свою первую игру',
      type: AchievementType.FIRST_PURCHASE,
      iconUrl: 'icon.png',
      points: 10,
      condition: { type: 'first_time', field: 'gamesPurchased' },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    currentValue: 1,
    targetValue: 1,
    progressPercentage: 100,
    updatedAt: new Date(),
  };

  const mockUserAchievement: UserAchievementResponseDto = {
    id: 'user-achievement-1',
    userId: 'user-1',
    achievementId: 'achievement-1',
    achievement: {
      id: 'achievement-1',
      name: 'Первая покупка',
      description: 'Купите свою первую игру',
      type: AchievementType.FIRST_PURCHASE,
      iconUrl: 'icon.png',
      points: 10,
      condition: { type: 'first_time', field: 'gamesPurchased' },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    unlockedAt: new Date(),
  };

  beforeEach(async () => {
    const mockProgressService = {
      updateProgress: jest.fn(),
      checkAchievements: jest.fn(),
    };

    const mockNotificationService = {
      sendAchievementUnlockedNotification: jest.fn(),
      sendBatchNotifications: jest.fn(),
    };

    const mockLibraryService = {
      getUserGameCount: jest.fn(),
      getUserLibraryStats: jest.fn(),
      hasGameInLibrary: jest.fn(),
      getUserGames: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventService,
        {
          provide: ProgressService,
          useValue: mockProgressService,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
        {
          provide: LibraryService,
          useValue: mockLibraryService,
        },
      ],
    }).compile();

    service = module.get<EventService>(EventService);
    progressService = module.get(ProgressService);
    notificationService = module.get(NotificationService);
    libraryService = module.get(LibraryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleGamePurchase', () => {
    it('should handle game purchase event successfully', async () => {
      const userId = 'user-1';
      const gameId = 'game-1';

      progressService.updateProgress.mockResolvedValue([mockUserProgress]);
      progressService.checkAchievements.mockResolvedValue([mockUserAchievement]);

      await service.handleGamePurchase(userId, gameId);

      expect(progressService.updateProgress).toHaveBeenCalledWith(
        userId,
        EventType.GAME_PURCHASE,
        expect.objectContaining({
          gameId,
          timestamp: expect.any(String),
        })
      );
      expect(progressService.checkAchievements).toHaveBeenCalledWith(userId);
    });

    it('should handle errors during game purchase processing', async () => {
      const userId = 'user-1';
      const gameId = 'game-1';
      const error = new Error('Database error');

      progressService.updateProgress.mockRejectedValue(error);

      await expect(service.handleGamePurchase(userId, gameId)).rejects.toThrow('Database error');
    });

    it('should notify about unlocked achievements', async () => {
      const userId = 'user-1';
      const gameId = 'game-1';

      progressService.updateProgress.mockResolvedValue([mockUserProgress]);
      progressService.checkAchievements.mockResolvedValue([mockUserAchievement]);

      const notifySpy = jest.spyOn(service, 'notifyAchievementUnlocked').mockResolvedValue();

      await service.handleGamePurchase(userId, gameId);

      expect(notifySpy).toHaveBeenCalledWith(userId, mockUserAchievement.achievement.id);
    });
  });

  describe('handleReviewCreated', () => {
    it('should handle review creation event successfully', async () => {
      const userId = 'user-1';
      const reviewId = 'review-1';

      progressService.updateProgress.mockResolvedValue([mockUserProgress]);
      progressService.checkAchievements.mockResolvedValue([]);

      await service.handleReviewCreated(userId, reviewId);

      expect(progressService.updateProgress).toHaveBeenCalledWith(
        userId,
        EventType.REVIEW_CREATED,
        expect.objectContaining({
          reviewId,
          timestamp: expect.any(String),
        })
      );
      expect(progressService.checkAchievements).toHaveBeenCalledWith(userId);
    });

    it('should handle errors during review creation processing', async () => {
      const userId = 'user-1';
      const reviewId = 'review-1';
      const error = new Error('Service error');

      progressService.updateProgress.mockRejectedValue(error);

      await expect(service.handleReviewCreated(userId, reviewId)).rejects.toThrow('Service error');
    });
  });

  describe('handleFriendAdded', () => {
    it('should handle friend addition event successfully', async () => {
      const userId = 'user-1';
      const friendId = 'friend-1';

      progressService.updateProgress.mockResolvedValue([mockUserProgress]);
      progressService.checkAchievements.mockResolvedValue([]);

      await service.handleFriendAdded(userId, friendId);

      expect(progressService.updateProgress).toHaveBeenCalledWith(
        userId,
        EventType.FRIEND_ADDED,
        expect.objectContaining({
          friendId,
          timestamp: expect.any(String),
        })
      );
      expect(progressService.checkAchievements).toHaveBeenCalledWith(userId);
    });

    it('should handle errors during friend addition processing', async () => {
      const userId = 'user-1';
      const friendId = 'friend-1';
      const error = new Error('Network error');

      progressService.updateProgress.mockResolvedValue([mockUserProgress]);
      progressService.checkAchievements.mockRejectedValue(error);

      await expect(service.handleFriendAdded(userId, friendId)).rejects.toThrow('Network error');
    });
  });

  describe('notifyAchievementUnlocked', () => {
    it('should notify about achievement unlock successfully', async () => {
      const userId = 'user-1';
      const achievementId = 'achievement-1';

      await expect(service.notifyAchievementUnlocked(userId, achievementId)).resolves.not.toThrow();
    });

    it('should not throw error if notification fails', async () => {
      const userId = 'user-1';
      const achievementId = 'achievement-1';

      // Mock private method to throw error
      const recordEventSpy = jest.spyOn(service as any, 'recordAchievementUnlockEvent')
        .mockRejectedValue(new Error('Notification service down'));

      await expect(service.notifyAchievementUnlocked(userId, achievementId)).resolves.not.toThrow();

      recordEventSpy.mockRestore();
    });
  });

  describe('integration scenarios', () => {
    it('should handle multiple achievements unlocked in one event', async () => {
      const userId = 'user-1';
      const gameId = 'game-1';

      const multipleAchievements = [
        mockUserAchievement,
        {
          ...mockUserAchievement,
          id: 'user-achievement-2',
          achievement: {
            ...mockUserAchievement.achievement,
            id: 'achievement-2',
            name: '5 игр',
          },
        },
      ];

      progressService.updateProgress.mockResolvedValue([mockUserProgress]);
      progressService.checkAchievements.mockResolvedValue(multipleAchievements);

      const notifySpy = jest.spyOn(service, 'notifyAchievementUnlocked').mockResolvedValue();

      await service.handleGamePurchase(userId, gameId);

      expect(notifySpy).toHaveBeenCalledTimes(2);
      expect(notifySpy).toHaveBeenCalledWith(userId, 'achievement-1');
      expect(notifySpy).toHaveBeenCalledWith(userId, 'achievement-2');
    });

    it('should continue processing even if one notification fails', async () => {
      const userId = 'user-1';
      const gameId = 'game-1';

      const multipleAchievements = [
        mockUserAchievement,
        {
          ...mockUserAchievement,
          id: 'user-achievement-2',
          achievement: {
            ...mockUserAchievement.achievement,
            id: 'achievement-2',
          },
        },
      ];

      progressService.updateProgress.mockResolvedValue([mockUserProgress]);
      progressService.checkAchievements.mockResolvedValue(multipleAchievements);

      // Mock the actual implementation to handle errors properly
      const notifySpy = jest.spyOn(service, 'notifyAchievementUnlocked')
        .mockImplementationOnce(async () => {
          // First call succeeds
          return Promise.resolve();
        })
        .mockImplementationOnce(async () => {
          // Second call fails but is caught internally
          throw new Error('Notification failed');
        });

      await expect(service.handleGamePurchase(userId, gameId)).resolves.not.toThrow();
      expect(notifySpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('private methods', () => {
    it('should record achievement unlock event', async () => {
      const userId = 'user-1';
      const achievementId = 'achievement-1';

      // Test private method through public interface
      await expect(service.notifyAchievementUnlocked(userId, achievementId)).resolves.not.toThrow();
    });

    it('should handle notification service errors gracefully', async () => {
      const userId = 'user-1';
      const achievementId = 'achievement-1';

      // Mock the private method to throw an error
      const recordEventSpy = jest.spyOn(service as any, 'recordAchievementUnlockEvent')
        .mockRejectedValue(new Error('Notification service unavailable'));

      await expect(service.notifyAchievementUnlocked(userId, achievementId)).resolves.not.toThrow();

      recordEventSpy.mockRestore();
    });
  });

  describe('comprehensive error scenarios', () => {
    it('should handle partial failure in checkAchievements', async () => {
      const userId = 'user-1';
      const gameId = 'game-1';

      progressService.updateProgress.mockResolvedValue([mockUserProgress]);
      progressService.checkAchievements.mockRejectedValue(new Error('Achievement check failed'));

      await expect(service.handleGamePurchase(userId, gameId)).rejects.toThrow('Achievement check failed');
    });

    it('should handle empty achievements array', async () => {
      const userId = 'user-1';
      const gameId = 'game-1';

      progressService.updateProgress.mockResolvedValue([mockUserProgress]);
      progressService.checkAchievements.mockResolvedValue([]);

      await expect(service.handleGamePurchase(userId, gameId)).resolves.not.toThrow();
    });

    it('should handle network timeout in notifications', async () => {
      const userId = 'user-1';
      const gameId = 'game-1';

      progressService.updateProgress.mockResolvedValue([mockUserProgress]);
      progressService.checkAchievements.mockResolvedValue([mockUserAchievement]);

      const notifySpy = jest.spyOn(service, 'notifyAchievementUnlocked')
        .mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          throw new Error('Network timeout');
        });

      await expect(service.handleGamePurchase(userId, gameId)).resolves.not.toThrow();

      notifySpy.mockRestore();
    });
  });

  describe('event data validation', () => {
    it('should handle invalid game purchase data', async () => {
      const userId = 'user-1';
      const gameId = '';

      progressService.updateProgress.mockResolvedValue([]);
      progressService.checkAchievements.mockResolvedValue([]);

      await expect(service.handleGamePurchase(userId, gameId)).resolves.not.toThrow();
    });

    it('should handle invalid review data', async () => {
      const userId = 'user-1';
      const reviewId = '';

      progressService.updateProgress.mockResolvedValue([]);
      progressService.checkAchievements.mockResolvedValue([]);

      await expect(service.handleReviewCreated(userId, reviewId)).resolves.not.toThrow();
    });

    it('should handle invalid friend data', async () => {
      const userId = 'user-1';
      const friendId = '';

      progressService.updateProgress.mockResolvedValue([]);
      progressService.checkAchievements.mockResolvedValue([]);

      await expect(service.handleFriendAdded(userId, friendId)).resolves.not.toThrow();
    });
  });
});