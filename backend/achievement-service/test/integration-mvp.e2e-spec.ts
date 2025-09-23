import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Achievement, UserAchievement, UserProgress } from '../src/achievement/entities';
import { AchievementType } from '../src/achievement/entities/achievement.entity';
import { NotificationService } from '../src/achievement/services/notification.service';
import { LibraryService } from '../src/achievement/services/library.service';

describe('MVP Integration (e2e)', () => {
  let app: INestApplication;
  let achievementRepository: Repository<Achievement>;
  let userAchievementRepository: Repository<UserAchievement>;
  let userProgressRepository: Repository<UserProgress>;
  let notificationService: NotificationService;
  let libraryService: LibraryService;

  const testUserId = '123e4567-e89b-12d3-a456-426614174000';
  const testGameId = '123e4567-e89b-12d3-a456-426614174001';
  const testReviewId = '123e4567-e89b-12d3-a456-426614174002';
  const testFriendId = '123e4567-e89b-12d3-a456-426614174003';

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
    .overrideProvider(NotificationService)
    .useValue({
      sendAchievementUnlockedNotification: jest.fn().mockResolvedValue({ success: true, message: 'Sent' }),
      checkNotificationServiceHealth: jest.fn().mockResolvedValue(true),
    })
    .overrideProvider(LibraryService)
    .useValue({
      getUserGameCount: jest.fn().mockResolvedValue(1),
      getUserLibraryStats: jest.fn().mockResolvedValue({ totalGames: 1, totalSpent: 1999 }),
      hasGameInLibrary: jest.fn().mockResolvedValue(true),
      checkLibraryServiceHealth: jest.fn().mockResolvedValue(true),
    })
    .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    achievementRepository = moduleFixture.get<Repository<Achievement>>(getRepositoryToken(Achievement));
    userAchievementRepository = moduleFixture.get<Repository<UserAchievement>>(getRepositoryToken(UserAchievement));
    userProgressRepository = moduleFixture.get<Repository<UserProgress>>(getRepositoryToken(UserProgress));
    notificationService = moduleFixture.get<NotificationService>(NotificationService);
    libraryService = moduleFixture.get<LibraryService>(LibraryService);

    // Очищаем базу данных
    await userProgressRepository.delete({});
    await userAchievementRepository.delete({});
    await achievementRepository.delete({});

    // Создаем тестовые достижения
    await createTestAchievements();
  });

  afterEach(async () => {
    await app.close();
  });

  async function createTestAchievements() {
    const achievements = [
      {
        name: 'Первая покупка',
        description: 'Купите свою первую игру',
        type: AchievementType.FIRST_PURCHASE,
        condition: { type: 'first_time', field: 'gamesPurchased' },
        points: 10,
        isActive: true,
      },
      {
        name: 'Первый отзыв',
        description: 'Оставьте свой первый отзыв',
        type: AchievementType.FIRST_REVIEW,
        condition: { type: 'first_time', field: 'reviewsWritten' },
        points: 5,
        isActive: true,
      },
      {
        name: 'Первый друг',
        description: 'Добавьте своего первого друга',
        type: AchievementType.FIRST_FRIEND,
        condition: { type: 'first_time', field: 'friendsAdded' },
        points: 5,
        isActive: true,
      },
      {
        name: '5 игр',
        description: 'Купите 5 игр',
        type: AchievementType.GAMES_PURCHASED,
        condition: { type: 'count', field: 'gamesPurchased', target: 5 },
        points: 25,
        isActive: true,
      },
    ];

    for (const achievementData of achievements) {
      const achievement = achievementRepository.create(achievementData);
      await achievementRepository.save(achievement);
    }
  }

  describe('Payment Service Integration', () => {
    it('should handle payment purchase webhook', async () => {
      const paymentEvent = {
        userId: testUserId,
        gameId: testGameId,
        transactionId: 'tx-123',
        amount: 1999,
        currency: 'RUB',
        timestamp: new Date().toISOString(),
      };

      const response = await request(app.getHttpServer())
        .post('/integration/payment/purchase')
        .send(paymentEvent)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Payment purchase event processed successfully',
      });

      // Проверяем, что прогресс обновился
      const progress = await userProgressRepository.find({
        where: { userId: testUserId },
        relations: ['achievement'],
      });

      expect(progress.length).toBeGreaterThan(0);
      expect(libraryService.getUserGameCount).toHaveBeenCalledWith(testUserId);
    });

    it('should unlock first purchase achievement', async () => {
      const paymentEvent = {
        userId: testUserId,
        gameId: testGameId,
        transactionId: 'tx-123',
        amount: 1999,
        currency: 'RUB',
        timestamp: new Date().toISOString(),
      };

      await request(app.getHttpServer())
        .post('/integration/payment/purchase')
        .send(paymentEvent)
        .expect(200);

      // Проверяем, что достижение разблокировано
      const unlockedAchievements = await userAchievementRepository.find({
        where: { userId: testUserId },
        relations: ['achievement'],
      });

      const firstPurchaseAchievement = unlockedAchievements.find(
        ua => ua.achievement.type === AchievementType.FIRST_PURCHASE
      );

      expect(firstPurchaseAchievement).toBeDefined();
      expect(notificationService.sendAchievementUnlockedNotification).toHaveBeenCalled();
    });
  });

  describe('Review Service Integration', () => {
    it('should handle review created webhook', async () => {
      const reviewEvent = {
        userId: testUserId,
        reviewId: testReviewId,
        gameId: testGameId,
        rating: 5,
        timestamp: new Date().toISOString(),
      };

      const response = await request(app.getHttpServer())
        .post('/integration/review/created')
        .send(reviewEvent)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Review created event processed successfully',
      });

      // Проверяем, что прогресс обновился
      const progress = await userProgressRepository.find({
        where: { userId: testUserId },
        relations: ['achievement'],
      });

      const reviewProgress = progress.find(
        p => p.achievement.type === AchievementType.FIRST_REVIEW
      );

      expect(reviewProgress).toBeDefined();
      expect(reviewProgress?.currentValue).toBe(1);
    });

    it('should unlock first review achievement', async () => {
      const reviewEvent = {
        userId: testUserId,
        reviewId: testReviewId,
        gameId: testGameId,
        rating: 5,
        timestamp: new Date().toISOString(),
      };

      await request(app.getHttpServer())
        .post('/integration/review/created')
        .send(reviewEvent)
        .expect(200);

      // Проверяем, что достижение разблокировано
      const unlockedAchievements = await userAchievementRepository.find({
        where: { userId: testUserId },
        relations: ['achievement'],
      });

      const firstReviewAchievement = unlockedAchievements.find(
        ua => ua.achievement.type === AchievementType.FIRST_REVIEW
      );

      expect(firstReviewAchievement).toBeDefined();
    });
  });

  describe('Social Service Integration', () => {
    it('should handle friend added webhook', async () => {
      const socialEvent = {
        userId: testUserId,
        friendId: testFriendId,
        eventType: 'friend_added' as const,
        timestamp: new Date().toISOString(),
      };

      const response = await request(app.getHttpServer())
        .post('/integration/social/friend')
        .send(socialEvent)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Social event processed successfully',
      });

      // Проверяем, что прогресс обновился
      const progress = await userProgressRepository.find({
        where: { userId: testUserId },
        relations: ['achievement'],
      });

      const friendProgress = progress.find(
        p => p.achievement.type === AchievementType.FIRST_FRIEND
      );

      expect(friendProgress).toBeDefined();
      expect(friendProgress?.currentValue).toBe(1);
    });

    it('should unlock first friend achievement', async () => {
      const socialEvent = {
        userId: testUserId,
        friendId: testFriendId,
        eventType: 'friend_added' as const,
        timestamp: new Date().toISOString(),
      };

      await request(app.getHttpServer())
        .post('/integration/social/friend')
        .send(socialEvent)
        .expect(200);

      // Проверяем, что достижение разблокировано
      const unlockedAchievements = await userAchievementRepository.find({
        where: { userId: testUserId },
        relations: ['achievement'],
      });

      const firstFriendAchievement = unlockedAchievements.find(
        ua => ua.achievement.type === AchievementType.FIRST_FRIEND
      );

      expect(firstFriendAchievement).toBeDefined();
    });

    it('should ignore friend removed events', async () => {
      const socialEvent = {
        userId: testUserId,
        friendId: testFriendId,
        eventType: 'friend_removed' as const,
        timestamp: new Date().toISOString(),
      };

      const response = await request(app.getHttpServer())
        .post('/integration/social/friend')
        .send(socialEvent)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Social event processed successfully',
      });

      // Проверяем, что прогресс не изменился
      const progress = await userProgressRepository.find({
        where: { userId: testUserId },
      });

      expect(progress.length).toBe(0);
    });
  });

  describe('Library Service Integration', () => {
    it('should handle library update webhook', async () => {
      const libraryEvent = {
        userId: testUserId,
        gameId: testGameId,
        action: 'added' as const,
        timestamp: new Date().toISOString(),
      };

      const response = await request(app.getHttpServer())
        .post('/integration/library/update')
        .send(libraryEvent)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Library update event processed successfully',
      });

      expect(libraryService.getUserGameCount).toHaveBeenCalledWith(testUserId);
    });

    it('should ignore library removal events', async () => {
      const libraryEvent = {
        userId: testUserId,
        gameId: testGameId,
        action: 'removed' as const,
        timestamp: new Date().toISOString(),
      };

      const response = await request(app.getHttpServer())
        .post('/integration/library/update')
        .send(libraryEvent)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Library update event processed successfully',
      });

      // Проверяем, что getUserGameCount не вызывался для removed events
      expect(libraryService.getUserGameCount).not.toHaveBeenCalled();
    });
  });

  describe('Integration Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app.getHttpServer())
        .post('/integration/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('End-to-End Achievement Flow', () => {
    it('should process complete user journey', async () => {
      // 1. Пользователь покупает игру
      await request(app.getHttpServer())
        .post('/integration/payment/purchase')
        .send({
          userId: testUserId,
          gameId: testGameId,
          transactionId: 'tx-123',
          amount: 1999,
          currency: 'RUB',
          timestamp: new Date().toISOString(),
        })
        .expect(200);

      // 2. Пользователь оставляет отзыв
      await request(app.getHttpServer())
        .post('/integration/review/created')
        .send({
          userId: testUserId,
          reviewId: testReviewId,
          gameId: testGameId,
          rating: 5,
          timestamp: new Date().toISOString(),
        })
        .expect(200);

      // 3. Пользователь добавляет друга
      await request(app.getHttpServer())
        .post('/integration/social/friend')
        .send({
          userId: testUserId,
          friendId: testFriendId,
          eventType: 'friend_added',
          timestamp: new Date().toISOString(),
        })
        .expect(200);

      // Проверяем, что все базовые достижения разблокированы
      const unlockedAchievements = await userAchievementRepository.find({
        where: { userId: testUserId },
        relations: ['achievement'],
      });

      expect(unlockedAchievements).toHaveLength(3);

      const achievementTypes = unlockedAchievements.map(ua => ua.achievement.type);
      expect(achievementTypes).toContain(AchievementType.FIRST_PURCHASE);
      expect(achievementTypes).toContain(AchievementType.FIRST_REVIEW);
      expect(achievementTypes).toContain(AchievementType.FIRST_FRIEND);

      // Проверяем, что уведомления отправлены
      expect(notificationService.sendAchievementUnlockedNotification).toHaveBeenCalledTimes(3);
    });

    it('should handle multiple game purchases for count achievements', async () => {
      // Mock library service to return increasing game counts
      (libraryService.getUserGameCount as jest.Mock)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(5);

      // Покупаем 5 игр
      for (let i = 1; i <= 5; i++) {
        await request(app.getHttpServer())
          .post('/integration/payment/purchase')
          .send({
            userId: testUserId,
            gameId: `game-${i}`,
            transactionId: `tx-${i}`,
            amount: 1999,
            currency: 'RUB',
            timestamp: new Date().toISOString(),
          })
          .expect(200);
      }

      // Проверяем, что достижение "5 игр" разблокировано
      const unlockedAchievements = await userAchievementRepository.find({
        where: { userId: testUserId },
        relations: ['achievement'],
      });

      const fiveGamesAchievement = unlockedAchievements.find(
        ua => ua.achievement.name === '5 игр'
      );

      expect(fiveGamesAchievement).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid webhook data gracefully', async () => {
      const invalidEvent = {
        userId: 'invalid-uuid',
        gameId: testGameId,
      };

      await request(app.getHttpServer())
        .post('/integration/payment/purchase')
        .send(invalidEvent)
        .expect(400);
    });

    it('should continue processing even if notification fails', async () => {
      // Mock notification service to fail
      (notificationService.sendAchievementUnlockedNotification as jest.Mock)
        .mockRejectedValueOnce(new Error('Notification service down'));

      const paymentEvent = {
        userId: testUserId,
        gameId: testGameId,
        transactionId: 'tx-123',
        amount: 1999,
        currency: 'RUB',
        timestamp: new Date().toISOString(),
      };

      const response = await request(app.getHttpServer())
        .post('/integration/payment/purchase')
        .send(paymentEvent)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Проверяем, что достижение все равно разблокировано
      const unlockedAchievements = await userAchievementRepository.find({
        where: { userId: testUserId },
      });

      expect(unlockedAchievements.length).toBeGreaterThan(0);
    });

    it('should handle library service failures gracefully', async () => {
      // Mock library service to fail
      (libraryService.getUserGameCount as jest.Mock)
        .mockRejectedValueOnce(new Error('Library service down'));

      const paymentEvent = {
        userId: testUserId,
        gameId: testGameId,
        transactionId: 'tx-123',
        amount: 1999,
        currency: 'RUB',
        timestamp: new Date().toISOString(),
      };

      const response = await request(app.getHttpServer())
        .post('/integration/payment/purchase')
        .send(paymentEvent)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});