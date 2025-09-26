import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationSettings } from '../src/entities';
import { JwtAuthGuard, RolesGuard } from '../src/auth';
import { HttpService } from '@nestjs/axios';
import { RedisCacheService } from '../src/cache/redis-cache.service';
import { EmailService } from '../src/notification/email.service';
import { NotificationType, NotificationChannel } from '../src/common/enums';
import { of } from 'rxjs';
import { mockHttpResponses, mockUserServiceResponses } from '../src/notification/__mocks__/email-providers.mock';

describe('Webhook Integration (e2e)', () => {
  let app: INestApplication;
  let notificationRepository: Repository<Notification>;
  let settingsRepository: Repository<NotificationSettings>;
  
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: () => true, // Webhooks are public endpoints
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: () => true,
      })
      .overrideProvider(RedisCacheService)
      .useValue({
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(false),
        del: jest.fn().mockResolvedValue(false),
        keys: jest.fn().mockResolvedValue([]),
        isRedisConnected: jest.fn().mockReturnValue(false),
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      })
      .overrideProvider(EmailService)
      .useValue({
        sendNotificationEmail: jest.fn().mockResolvedValue(undefined),
        sendEmail: jest.fn().mockResolvedValue(undefined),
        sendEmailWithRetry: jest.fn().mockResolvedValue(undefined),
      })
      .overrideProvider(HttpService)
      .useValue({
        get: jest.fn().mockReturnValue(of(mockUserServiceResponses.validUser)),
        post: jest.fn().mockReturnValue(of(mockHttpResponses.generic.success)),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    notificationRepository = moduleFixture.get<Repository<Notification>>(
      getRepositoryToken(Notification),
    );
    settingsRepository = moduleFixture.get<Repository<NotificationSettings>>(
      getRepositoryToken(NotificationSettings),
    );
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    // Clean up database before each test
    await notificationRepository.delete({ userId: mockUserId });
    await settingsRepository.delete({ userId: mockUserId });
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Payment Service Integration', () => {
    describe('Payment Completed Webhook', () => {
      it('should create notification for successful payment', async () => {
        const paymentEvent = {
          userId: mockUserId,
          eventType: 'payment.completed',
          data: {
            paymentId: 'payment-123',
            gameId: 'game-456',
            gameName: 'Cyberpunk 2077',
            amount: 1999,
            currency: 'RUB',
          },
        };

        await request(app.getHttpServer())
          .post('/notifications/webhook/payment/completed')
          .send(paymentEvent)
          .expect(202)
          .expect((res) => {
            expect(res.body.status).toEqual('accepted');
          });

        // Verify notification was created
        const notifications = await notificationRepository.find({
          where: { userId: mockUserId },
        });

        expect(notifications).toHaveLength(1);
        expect(notifications[0].type).toBe(NotificationType.PURCHASE);
        expect(notifications[0].title).toBe('Покупка успешно завершена');
        expect(notifications[0].message).toContain('Cyberpunk 2077');
        expect(notifications[0].message).toContain('1999 RUB');
        expect(notifications[0].metadata).toEqual({
          paymentId: 'payment-123',
          gameId: 'game-456',
          gameName: 'Cyberpunk 2077',
          amount: 1999,
          currency: 'RUB',
        });
        expect(notifications[0].channels).toEqual([
          NotificationChannel.IN_APP,
          NotificationChannel.EMAIL,
        ]);
      });

      it('should handle payment completed with missing optional fields', async () => {
        const paymentEvent = {
          userId: mockUserId,
          eventType: 'payment.completed',
          data: {
            paymentId: 'payment-123',
            gameId: 'game-456',
            gameName: 'Test Game',
            amount: 999,
            currency: 'RUB',
            // No optional fields
          },
        };

        await request(app.getHttpServer())
          .post('/notifications/webhook/payment/completed')
          .send(paymentEvent)
          .expect(202);

        const notifications = await notificationRepository.find({
          where: { userId: mockUserId },
        });

        expect(notifications).toHaveLength(1);
        expect(notifications[0].type).toBe(NotificationType.PURCHASE);
      });
    });

    describe('Payment Failed Webhook', () => {
      it('should create notification for failed payment', async () => {
        const paymentEvent = {
          userId: mockUserId,
          eventType: 'payment.failed',
          data: {
            paymentId: 'payment-123',
            gameId: 'game-456',
            gameName: 'Cyberpunk 2077',
            amount: 1999,
            currency: 'RUB',
            errorMessage: 'Insufficient funds',
          },
        };

        await request(app.getHttpServer())
          .post('/notifications/webhook/payment/failed')
          .send(paymentEvent)
          .expect(202);

        const notifications = await notificationRepository.find({
          where: { userId: mockUserId },
        });

        expect(notifications).toHaveLength(1);
        expect(notifications[0].type).toBe(NotificationType.PURCHASE);
        expect(notifications[0].title).toBe('Ошибка при оплате');
        expect(notifications[0].message).toContain('Insufficient funds');
        expect(notifications[0].metadata?.errorMessage).toBe('Insufficient funds');
      });

      it('should handle payment failed without error message', async () => {
        const paymentEvent = {
          userId: mockUserId,
          eventType: 'payment.failed',
          data: {
            paymentId: 'payment-123',
            gameId: 'game-456',
            gameName: 'Test Game',
            amount: 999,
            currency: 'RUB',
            // No errorMessage
          },
        };

        await request(app.getHttpServer())
          .post('/notifications/webhook/payment/failed')
          .send(paymentEvent)
          .expect(202);

        const notifications = await notificationRepository.find({
          where: { userId: mockUserId },
        });

        expect(notifications).toHaveLength(1);
        expect(notifications[0].message).toContain('Попробуйте еще раз или обратитесь в поддержку');
      });
    });
  });

  describe('Social Service Integration', () => {
    describe('Friend Request Webhook', () => {
      it('should create notification for friend request', async () => {
        const socialEvent = {
          userId: mockUserId,
          eventType: 'friend.request',
          data: {
            fromUserId: 'friend-user-id',
            fromUserName: 'Алексей Петров',
          },
        };

        await request(app.getHttpServer())
          .post('/notifications/webhook/social/friend-request')
          .send(socialEvent)
          .expect(202);

        const notifications = await notificationRepository.find({
          where: { userId: mockUserId },
        });

        expect(notifications).toHaveLength(1);
        expect(notifications[0].type).toBe(NotificationType.FRIEND_REQUEST);
        expect(notifications[0].title).toBe('Новая заявка в друзья');
        expect(notifications[0].message).toContain('Алексей Петров');
        expect(notifications[0].channels).toEqual([NotificationChannel.IN_APP]);
        expect(notifications[0].metadata).toEqual({
          fromUserId: 'friend-user-id',
          fromUserName: 'Алексей Петров',
        });
      });
    });

    describe('Friend Accepted Webhook', () => {
      it('should create notification for friend acceptance', async () => {
        const socialEvent = {
          userId: mockUserId,
          eventType: 'friend.accepted',
          data: {
            fromUserId: 'friend-user-id',
            fromUserName: 'Мария Иванова',
          },
        };

        await request(app.getHttpServer())
          .post('/notifications/webhook/social/friend-accepted')
          .send(socialEvent)
          .expect(202);

        const notifications = await notificationRepository.find({
          where: { userId: mockUserId },
        });

        expect(notifications).toHaveLength(1);
        expect(notifications[0].type).toBe(NotificationType.FRIEND_REQUEST);
        expect(notifications[0].title).toBe('Заявка в друзья принята');
        expect(notifications[0].message).toContain('Мария Иванова принял вашу заявку');
      });
    });

    describe('Message Webhook', () => {
      it('should create notification for new message', async () => {
        const socialEvent = {
          userId: mockUserId,
          eventType: 'message.received',
          data: {
            fromUserId: 'sender-user-id',
            fromUserName: 'Игорь Сидоров',
            messageId: 'message-123',
            messagePreview: 'Привет! Как дела?',
          },
        };

        await request(app.getHttpServer())
          .post('/notifications/webhook/social/message')
          .send(socialEvent)
          .expect(202);

        const notifications = await notificationRepository.find({
          where: { userId: mockUserId },
        });

        expect(notifications).toHaveLength(1);
        expect(notifications[0].type).toBe(NotificationType.SYSTEM);
        expect(notifications[0].title).toBe('Новое сообщение');
        expect(notifications[0].message).toContain('Игорь Сидоров: Привет! Как дела?');
        expect(notifications[0].metadata).toEqual({
          fromUserId: 'sender-user-id',
          fromUserName: 'Игорь Сидоров',
          messageId: 'message-123',
          messagePreview: 'Привет! Как дела?',
        });
      });

      it('should handle message without preview', async () => {
        const socialEvent = {
          userId: mockUserId,
          eventType: 'message.received',
          data: {
            fromUserId: 'sender-user-id',
            fromUserName: 'Игорь Сидоров',
            messageId: 'message-123',
            // No messagePreview
          },
        };

        await request(app.getHttpServer())
          .post('/notifications/webhook/social/message')
          .send(socialEvent)
          .expect(202);

        const notifications = await notificationRepository.find({
          where: { userId: mockUserId },
        });

        expect(notifications).toHaveLength(1);
        expect(notifications[0].message).toContain('Отправил вам сообщение');
      });
    });
  });

  describe('Achievement Service Integration', () => {
    it('should create notification for achievement unlock', async () => {
      const achievementEvent = {
        userId: mockUserId,
        eventType: 'achievement.unlocked',
        data: {
          achievementId: 'achievement-123',
          achievementName: 'Первая победа',
          achievementDescription: 'Выиграйте свою первую игру',
          gameId: 'game-456',
          gameName: 'Dota 2',
          points: 100,
        },
      };

      await request(app.getHttpServer())
        .post('/notifications/webhook/achievement/unlocked')
        .send(achievementEvent)
        .expect(202);

      const notifications = await notificationRepository.find({
        where: { userId: mockUserId },
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe(NotificationType.ACHIEVEMENT);
      expect(notifications[0].title).toBe('Достижение разблокировано!');
      expect(notifications[0].message).toContain('Первая победа');
      expect(notifications[0].message).toContain('Dota 2');
      expect(notifications[0].message).toContain('+100 очков');
      expect(notifications[0].metadata).toEqual({
        achievementId: 'achievement-123',
        achievementName: 'Первая победа',
        achievementDescription: 'Выиграйте свою первую игру',
        gameId: 'game-456',
        gameName: 'Dota 2',
        points: 100,
      });
    });

    it('should handle achievement without points', async () => {
      const achievementEvent = {
        userId: mockUserId,
        eventType: 'achievement.unlocked',
        data: {
          achievementId: 'achievement-123',
          achievementName: 'Исследователь',
          achievementDescription: 'Откройте все локации',
          gameId: 'game-456',
          gameName: 'The Witcher 3',
          // No points
        },
      };

      await request(app.getHttpServer())
        .post('/notifications/webhook/achievement/unlocked')
        .send(achievementEvent)
        .expect(202);

      const notifications = await notificationRepository.find({
        where: { userId: mockUserId },
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].message).not.toContain('очков');
    });
  });

  describe('Review Service Integration', () => {
    it('should create notification for new review', async () => {
      const reviewEvent = {
        userId: mockUserId,
        eventType: 'review.created',
        data: {
          reviewId: 'review-123',
          gameId: 'game-456',
          gameName: 'Half-Life: Alyx',
          reviewerName: 'Анна Козлова',
          rating: 5,
        },
      };

      await request(app.getHttpServer())
        .post('/notifications/webhook/review/created')
        .send(reviewEvent)
        .expect(202);

      const notifications = await notificationRepository.find({
        where: { userId: mockUserId },
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe(NotificationType.SYSTEM);
      expect(notifications[0].title).toBe('Новый отзыв на игру');
      expect(notifications[0].message).toContain('Анна Козлова');
      expect(notifications[0].message).toContain('5/5 звезд');
      expect(notifications[0].message).toContain('Half-Life: Alyx');
      expect(notifications[0].metadata).toEqual({
        reviewId: 'review-123',
        gameId: 'game-456',
        gameName: 'Half-Life: Alyx',
        reviewerName: 'Анна Козлова',
        rating: 5,
      });
    });
  });

  describe('Game Catalog Service Integration', () => {
    describe('Game Updated Webhook', () => {
      it('should create notification for game update', async () => {
        const gameEvent = {
          userId: mockUserId,
          eventType: 'game.updated',
          data: {
            gameId: 'game-456',
            gameName: 'Counter-Strike 2',
            updateType: 'content',
            version: '1.2.0',
          },
        };

        await request(app.getHttpServer())
          .post('/notifications/webhook/game-catalog/updated')
          .send(gameEvent)
          .expect(202);

        const notifications = await notificationRepository.find({
          where: { userId: mockUserId },
        });

        expect(notifications).toHaveLength(1);
        expect(notifications[0].type).toBe(NotificationType.GAME_UPDATE);
        expect(notifications[0].title).toBe('Обновление игры: Counter-Strike 2');
        expect(notifications[0].message).toContain('1.2.0');
        expect(notifications[0].message).toContain('Новый контент');
        expect(notifications[0].channels).toEqual([
          NotificationChannel.IN_APP,
          NotificationChannel.EMAIL,
        ]);
      });

      it('should handle patch updates differently', async () => {
        const gameEvent = {
          userId: mockUserId,
          eventType: 'game.updated',
          data: {
            gameId: 'game-456',
            gameName: 'Dota 2',
            updateType: 'patch',
            version: '7.35b',
          },
        };

        await request(app.getHttpServer())
          .post('/notifications/webhook/game-catalog/updated')
          .send(gameEvent)
          .expect(202);

        const notifications = await notificationRepository.find({
          where: { userId: mockUserId },
        });

        expect(notifications).toHaveLength(1);
        expect(notifications[0].message).toContain('Исправления и улучшения');
      });
    });

    describe('Game Sale Started Webhook', () => {
      it('should create notification for game sale', async () => {
        const gameEvent = {
          userId: mockUserId,
          eventType: 'game.sale_started',
          data: {
            gameId: 'game-456',
            gameName: 'Red Dead Redemption 2',
            saleDiscount: 50,
          },
        };

        await request(app.getHttpServer())
          .post('/notifications/webhook/game-catalog/sale-started')
          .send(gameEvent)
          .expect(202);

        const notifications = await notificationRepository.find({
          where: { userId: mockUserId },
        });

        expect(notifications).toHaveLength(1);
        expect(notifications[0].type).toBe(NotificationType.GAME_UPDATE);
        expect(notifications[0].title).toBe('Скидка на игру: Red Dead Redemption 2');
        expect(notifications[0].message).toContain('Скидка 50%');
        expect(notifications[0].metadata?.saleDiscount).toBe(50);
      });
    });
  });

  describe('Library Service Integration', () => {
    describe('Game Added Webhook', () => {
      it('should create notification for game added to library', async () => {
        const libraryEvent = {
          userId: mockUserId,
          eventType: 'library.game_added',
          data: {
            gameId: 'game-456',
            gameName: 'Baldur\'s Gate 3',
            addedAt: '2024-01-01T10:00:00.000Z',
          },
        };

        await request(app.getHttpServer())
          .post('/notifications/webhook/library/game-added')
          .send(libraryEvent)
          .expect(202);

        const notifications = await notificationRepository.find({
          where: { userId: mockUserId },
        });

        expect(notifications).toHaveLength(1);
        expect(notifications[0].type).toBe(NotificationType.SYSTEM);
        expect(notifications[0].title).toBe('Игра добавлена в библиотеку');
        expect(notifications[0].message).toContain('Baldur\'s Gate 3');
        expect(notifications[0].channels).toEqual([NotificationChannel.IN_APP]);
        expect(notifications[0].metadata).toEqual({
          gameId: 'game-456',
          gameName: 'Baldur\'s Gate 3',
          addedAt: '2024-01-01T10:00:00.000Z',
        });
      });
    });

    describe('Game Removed Webhook', () => {
      it('should create notification for game removed from library', async () => {
        const libraryEvent = {
          userId: mockUserId,
          eventType: 'library.game_removed',
          data: {
            gameId: 'game-456',
            gameName: 'Old Game',
            removedAt: '2024-01-01T10:00:00.000Z',
          },
        };

        await request(app.getHttpServer())
          .post('/notifications/webhook/library/game-removed')
          .send(libraryEvent)
          .expect(202);

        const notifications = await notificationRepository.find({
          where: { userId: mockUserId },
        });

        expect(notifications).toHaveLength(1);
        expect(notifications[0].type).toBe(NotificationType.SYSTEM);
        expect(notifications[0].title).toBe('Игра удалена из библиотеки');
        expect(notifications[0].message).toContain('Old Game');
      });
    });
  });

  describe('Webhook Validation and Error Handling', () => {
    it('should validate required fields in webhook payloads', async () => {
      const invalidPayload = {
        // Missing userId
        eventType: 'payment.completed',
        data: {
          paymentId: 'payment-123',
        },
      };

      await request(app.getHttpServer())
        .post('/notifications/webhook/payment/completed')
        .send(invalidPayload)
        .expect(400);
    });

    it('should handle malformed JSON gracefully', async () => {
      await request(app.getHttpServer())
        .post('/notifications/webhook/payment/completed')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);
    });

    it('should handle empty request body', async () => {
      await request(app.getHttpServer())
        .post('/notifications/webhook/payment/completed')
        .send({})
        .expect(400);
    });

    it('should handle very large payloads', async () => {
      const largePayload = {
        userId: mockUserId,
        eventType: 'payment.completed',
        data: {
          paymentId: 'payment-123',
          gameId: 'game-456',
          gameName: 'A'.repeat(10000), // Very long game name
          amount: 1999,
          currency: 'RUB',
        },
      };

      // Should still process the request but might truncate the data
      await request(app.getHttpServer())
        .post('/notifications/webhook/payment/completed')
        .send(largePayload)
        .expect(202);
    });
  });

  describe('User Settings Respect', () => {
    it('should respect user notification settings', async () => {
      // Disable friend request notifications for user
      await settingsRepository.save({
        userId: mockUserId,
        friendRequests: false,
        inAppNotifications: true,
      });

      const socialEvent = {
        userId: mockUserId,
        eventType: 'friend.request',
        data: {
          fromUserId: 'friend-user-id',
          fromUserName: 'Test Friend',
        },
      };

      await request(app.getHttpServer())
        .post('/notifications/webhook/social/friend-request')
        .send(socialEvent)
        .expect(202);

      // Should not create notification because friend requests are disabled
      const notifications = await notificationRepository.find({
        where: { userId: mockUserId },
      });

      expect(notifications).toHaveLength(0);
    });

    it('should respect email notification settings', async () => {
      // Disable email notifications for user
      await settingsRepository.save({
        userId: mockUserId,
        emailNotifications: false,
        inAppNotifications: true,
        purchases: true,
      });

      const paymentEvent = {
        userId: mockUserId,
        eventType: 'payment.completed',
        data: {
          paymentId: 'payment-123',
          gameId: 'game-456',
          gameName: 'Test Game',
          amount: 1999,
          currency: 'RUB',
        },
      };

      await request(app.getHttpServer())
        .post('/notifications/webhook/payment/completed')
        .send(paymentEvent)
        .expect(202);

      const notifications = await notificationRepository.find({
        where: { userId: mockUserId },
      });

      expect(notifications).toHaveLength(1);
      // Should only have IN_APP channel, not EMAIL
      expect(notifications[0].channels).toEqual([NotificationChannel.IN_APP]);
    });

    it('should not create notification if all notifications are disabled', async () => {
      // Disable all notifications for user
      await settingsRepository.save({
        userId: mockUserId,
        inAppNotifications: false,
        emailNotifications: false,
      });

      const paymentEvent = {
        userId: mockUserId,
        eventType: 'payment.completed',
        data: {
          paymentId: 'payment-123',
          gameId: 'game-456',
          gameName: 'Test Game',
          amount: 1999,
          currency: 'RUB',
        },
      };

      await request(app.getHttpServer())
        .post('/notifications/webhook/payment/completed')
        .send(paymentEvent)
        .expect(202);

      const notifications = await notificationRepository.find({
        where: { userId: mockUserId },
      });

      expect(notifications).toHaveLength(0);
    });
  });

  describe('Concurrent Webhook Processing', () => {
    it('should handle multiple concurrent webhooks for same user', async () => {
      const webhookRequests = [
        {
          url: '/notifications/webhook/payment/completed',
          data: {
            userId: mockUserId,
            eventType: 'payment.completed',
            data: {
              paymentId: 'payment-1',
              gameId: 'game-1',
              gameName: 'Game 1',
              amount: 1000,
              currency: 'RUB',
            },
          },
        },
        {
          url: '/notifications/webhook/social/friend-request',
          data: {
            userId: mockUserId,
            eventType: 'friend.request',
            data: {
              fromUserId: 'friend-1',
              fromUserName: 'Friend 1',
            },
          },
        },
        {
          url: '/notifications/webhook/achievement/unlocked',
          data: {
            userId: mockUserId,
            eventType: 'achievement.unlocked',
            data: {
              achievementId: 'achievement-1',
              achievementName: 'Achievement 1',
              achievementDescription: 'First achievement',
              gameId: 'game-1',
              gameName: 'Game 1',
              points: 50,
            },
          },
        },
      ];

      const requests = webhookRequests.map((webhook) =>
        request(app.getHttpServer())
          .post(webhook.url)
          .send(webhook.data)
          .expect(202)
      );

      await Promise.all(requests);

      const notifications = await notificationRepository.find({
        where: { userId: mockUserId },
        order: { createdAt: 'ASC' },
      });

      expect(notifications).toHaveLength(3);
      expect(notifications[0].type).toBe(NotificationType.PURCHASE);
      expect(notifications[1].type).toBe(NotificationType.FRIEND_REQUEST);
      expect(notifications[2].type).toBe(NotificationType.ACHIEVEMENT);
    });
  });
});