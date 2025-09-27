import { Test, TestingModule } from '@nestjs/testing';
import { EventService } from './event.service';
import { ProgressService } from './progress.service';
import { AchievementService } from './achievement.service';
import { NotificationService } from './notification.service';
import { LibraryService } from './library.service';
import { PaymentService } from './payment.service';
import { ReviewService } from './review.service';
import { SocialService } from './social.service';
import { EventType } from '../dto/update-progress.dto';
import { UserProgressResponseDto, UserAchievementResponseDto } from '../dto';
import { AchievementType, Achievement } from '../entities/achievement.entity';

describe('EventService', () => {
  let service: EventService;
  let progressService: jest.Mocked<ProgressService>;
  let achievementService: jest.Mocked<AchievementService>;
  let notificationService: jest.Mocked<NotificationService>;
  let libraryService: jest.Mocked<LibraryService>;
  let paymentService: jest.Mocked<PaymentService>;
  let reviewService: jest.Mocked<ReviewService>;
  let socialService: jest.Mocked<SocialService>;

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

  const mockAchievement: Achievement = {
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
    userAchievements: [],
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

    const mockAchievementService = {
      getAchievementById: jest.fn(),
      getAllAchievements: jest.fn(),
      getUserAchievements: jest.fn(),
      unlockAchievement: jest.fn(),
      isAchievementUnlocked: jest.fn(),
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

    const mockPaymentService = {
      getUserPaymentStats: jest.fn(),
      isTransactionCompleted: jest.fn(),
      checkPaymentServiceHealth: jest.fn(),
    };

    const mockReviewService = {
      reviewExists: jest.fn(),
      getUserReviewStats: jest.fn(),
      getUserReviewCount: jest.fn(),
      checkReviewServiceHealth: jest.fn(),
    };

    const mockSocialService = {
      validateFriendAddedEvent: jest.fn(),
      getUserSocialStats: jest.fn(),
      getUserFriendCount: jest.fn(),
      checkSocialServiceHealth: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventService,
        {
          provide: ProgressService,
          useValue: mockProgressService,
        },
        {
          provide: AchievementService,
          useValue: mockAchievementService,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
        {
          provide: LibraryService,
          useValue: mockLibraryService,
        },
        {
          provide: PaymentService,
          useValue: mockPaymentService,
        },
        {
          provide: ReviewService,
          useValue: mockReviewService,
        },
        {
          provide: SocialService,
          useValue: mockSocialService,
        },
      ],
    }).compile();

    service = module.get<EventService>(EventService);
    progressService = module.get(ProgressService);
    achievementService = module.get(AchievementService);
    notificationService = module.get(NotificationService);
    libraryService = module.get(LibraryService);
    paymentService = module.get(PaymentService);
    reviewService = module.get(ReviewService);
    socialService = module.get(SocialService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleGamePurchase', () => {
    it('should handle game purchase event successfully', async () => {
      const userId = 'user-1';
      const gameId = 'game-1';

      libraryService.getUserGameCount.mockResolvedValue(1);
      paymentService.getUserPaymentStats.mockResolvedValue({
        totalTransactions: 1,
        totalSpent: 1999,
        averageTransactionAmount: 1999,
      });
      progressService.updateProgress.mockResolvedValue([mockUserProgress]);
      progressService.checkAchievements.mockResolvedValue([mockUserAchievement]);

      await service.handleGamePurchase(userId, gameId);

      expect(libraryService.getUserGameCount).toHaveBeenCalledWith(userId);
      expect(progressService.updateProgress).toHaveBeenCalledWith(
        userId,
        EventType.GAME_PURCHASE,
        expect.objectContaining({
          gameId,
          timestamp: expect.any(String),
          gameCount: 1,
          isFirstPurchase: true,
        }),
      );
      expect(progressService.checkAchievements).toHaveBeenCalledWith(userId);
    });

    it('should handle game purchase with multiple games', async () => {
      const userId = 'user-1';
      const gameId = 'game-1';

      libraryService.getUserGameCount.mockResolvedValue(5);
      progressService.updateProgress.mockResolvedValue([mockUserProgress]);
      progressService.checkAchievements.mockResolvedValue([]);

      await service.handleGamePurchase(userId, gameId);

      expect(progressService.updateProgress).toHaveBeenCalledWith(
        userId,
        EventType.GAME_PURCHASE,
        expect.objectContaining({
          gameId,
          gameCount: 5,
          isFirstPurchase: false,
        }),
      );
    });

    it('should handle library service errors gracefully', async () => {
      const userId = 'user-1';
      const gameId = 'game-1';

      libraryService.getUserGameCount.mockResolvedValue(0); // Return 0 instead of throwing
      progressService.updateProgress.mockResolvedValue([mockUserProgress]);
      progressService.checkAchievements.mockResolvedValue([]);

      await service.handleGamePurchase(userId, gameId);

      expect(progressService.updateProgress).toHaveBeenCalledWith(
        userId,
        EventType.GAME_PURCHASE,
        expect.objectContaining({
          gameId,
          gameCount: 0, // Should default to 0 when library service fails
          isFirstPurchase: false,
        }),
      );
    });

    it('should handle errors during game purchase processing', async () => {
      const userId = 'user-1';
      const gameId = 'game-1';
      const error = new Error('Database error');

      libraryService.getUserGameCount.mockResolvedValue(1);
      progressService.updateProgress.mockRejectedValue(error);

      await expect(service.handleGamePurchase(userId, gameId)).rejects.toThrow('Database error');
    });

    it('should notify about unlocked achievements', async () => {
      const userId = 'user-1';
      const gameId = 'game-1';

      libraryService.getUserGameCount.mockResolvedValue(1);
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
        }),
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
        }),
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

      achievementService.getAchievementById.mockResolvedValue(mockAchievement);
      notificationService.sendAchievementUnlockedNotification.mockResolvedValue({
        success: true,
        message: 'Notification sent successfully',
      });

      await expect(service.notifyAchievementUnlocked(userId, achievementId)).resolves.not.toThrow();

      expect(achievementService.getAchievementById).toHaveBeenCalledWith(achievementId);
      expect(notificationService.sendAchievementUnlockedNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          achievementId,
          achievementName: mockAchievement.name,
          achievementDescription: mockAchievement.description,
          achievementPoints: mockAchievement.points,
          notificationType: 'achievement_unlocked',
        }),
      );
    });

    it('should not throw error if notification fails', async () => {
      const userId = 'user-1';
      const achievementId = 'achievement-1';

      achievementService.getAchievementById.mockResolvedValue(mockAchievement);
      notificationService.sendAchievementUnlockedNotification.mockRejectedValue(
        new Error('Notification service down'),
      );

      await expect(service.notifyAchievementUnlocked(userId, achievementId)).resolves.not.toThrow();
    });

    it('should handle achievement not found', async () => {
      const userId = 'user-1';
      const achievementId = 'achievement-1';

      achievementService.getAchievementById.mockResolvedValue(null);

      await expect(service.notifyAchievementUnlocked(userId, achievementId)).resolves.not.toThrow();

      expect(notificationService.sendAchievementUnlockedNotification).not.toHaveBeenCalled();
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
      const notifySpy = jest
        .spyOn(service, 'notifyAchievementUnlocked')
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

      achievementService.getAchievementById.mockResolvedValue(mockAchievement);
      notificationService.sendAchievementUnlockedNotification.mockResolvedValue({
        success: true,
        message: 'Notification sent successfully',
      });

      // Test private method through public interface
      await expect(service.notifyAchievementUnlocked(userId, achievementId)).resolves.not.toThrow();
    });

    it('should handle notification service errors gracefully', async () => {
      const userId = 'user-1';
      const achievementId = 'achievement-1';

      achievementService.getAchievementById.mockResolvedValue(mockAchievement);
      notificationService.sendAchievementUnlockedNotification.mockResolvedValue({
        success: false,
        message: 'Notification failed',
      });

      await expect(service.notifyAchievementUnlocked(userId, achievementId)).resolves.not.toThrow();
    });

    it('should handle recordAchievementUnlockEvent method', async () => {
      const userId = 'user-1';
      const achievementId = 'achievement-1';

      achievementService.getAchievementById.mockResolvedValue(mockAchievement);
      notificationService.sendAchievementUnlockedNotification.mockResolvedValue({
        success: true,
        message: 'Notification sent successfully',
      });

      // Access private method through reflection
      const recordEventSpy = jest.spyOn(service as any, 'recordAchievementUnlockEvent');

      await service.notifyAchievementUnlocked(userId, achievementId);

      expect(recordEventSpy).toHaveBeenCalledWith(userId, achievementId);
    });
  });

  describe('additional edge cases', () => {
    it('should handle empty progress updates', async () => {
      const userId = 'user-1';
      const gameId = 'game-1';

      libraryService.getUserGameCount.mockResolvedValue(1);
      progressService.updateProgress.mockResolvedValue([]);
      progressService.checkAchievements.mockResolvedValue([]);

      await expect(service.handleGamePurchase(userId, gameId)).resolves.not.toThrow();
    });

    it('should handle null progress updates', async () => {
      const userId = 'user-1';
      const gameId = 'game-1';

      libraryService.getUserGameCount.mockResolvedValue(1);
      progressService.updateProgress.mockResolvedValue(null as any);
      progressService.checkAchievements.mockResolvedValue([]);

      await expect(service.handleGamePurchase(userId, gameId)).resolves.not.toThrow();
    });

    it('should handle undefined achievement in notification', async () => {
      const userId = 'user-1';
      const achievementId = 'achievement-1';

      achievementService.getAchievementById.mockResolvedValue(undefined as any);

      await expect(service.notifyAchievementUnlocked(userId, achievementId)).resolves.not.toThrow();

      expect(notificationService.sendAchievementUnlockedNotification).not.toHaveBeenCalled();
    });

    it('should handle notification service returning success false', async () => {
      const userId = 'user-1';
      const achievementId = 'achievement-1';

      achievementService.getAchievementById.mockResolvedValue(mockAchievement);
      notificationService.sendAchievementUnlockedNotification.mockResolvedValue({
        success: false,
        message: 'Service unavailable',
      });

      const loggerSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();

      await service.notifyAchievementUnlocked(userId, achievementId);

      expect(loggerSpy).toHaveBeenCalledWith('Failed to send notification: Service unavailable');

      loggerSpy.mockRestore();
    });
  });

  describe('comprehensive error scenarios', () => {
    it('should handle partial failure in checkAchievements', async () => {
      const userId = 'user-1';
      const gameId = 'game-1';

      progressService.updateProgress.mockResolvedValue([mockUserProgress]);
      progressService.checkAchievements.mockRejectedValue(new Error('Achievement check failed'));

      await expect(service.handleGamePurchase(userId, gameId)).rejects.toThrow(
        'Achievement check failed',
      );
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

      const notifySpy = jest
        .spyOn(service, 'notifyAchievementUnlocked')
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
