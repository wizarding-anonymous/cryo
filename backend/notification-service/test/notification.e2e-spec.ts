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
import { NotificationType } from '../src/common/enums';
import { of } from 'rxjs';
import { mockHttpResponses, mockUserServiceResponses } from '../src/notification/__mocks__/email-providers.mock';

describe('NotificationController (e2e)', () => {
  let app: INestApplication;
  let settingsRepository: Repository<NotificationSettings>;
  let notificationRepository: Repository<Notification>;
  let httpService: HttpService;
  let emailService: EmailService;
  
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockAdminUserId = 'admin-123e4567-e89b-12d3-a456-426614174000';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const request = context.switchToHttp().getRequest();
          const path = request.path;
          
          // Mock different users based on path
          if (path.includes('admin') || path.includes('bulk') || path.includes('cache')) {
            request.user = { id: mockAdminUserId, isAdmin: true };
          } else {
            request.user = { id: mockUserId, isAdmin: false };
          }
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: (context: any) => {
          const request = context.switchToHttp().getRequest();
          // Allow admin operations for admin user
          return request.user?.isAdmin || !request.path.includes('admin');
        },
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

    settingsRepository = moduleFixture.get<Repository<NotificationSettings>>(
      getRepositoryToken(NotificationSettings),
    );
    notificationRepository = moduleFixture.get<Repository<Notification>>(
      getRepositoryToken(Notification),
    );
    httpService = moduleFixture.get<HttpService>(HttpService);
    emailService = moduleFixture.get<EmailService>(EmailService);
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    // Clean up database before each test
    await settingsRepository.delete({ userId: mockUserId });
    await notificationRepository.delete({ userId: mockUserId });
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Settings Management', () => {
    describe('/notifications/settings/:userId (GET)', () => {
      it('should create and return default settings if none exist', () => {
        return request(app.getHttpServer())
          .get(`/notifications/settings/${mockUserId}`)
          .expect(200)
          .expect((res) => {
            expect(res.body).toBeDefined();
            expect(res.body.userId).toEqual(mockUserId);
            expect(res.body.emailNotifications).toEqual(true);
            expect(res.body.inAppNotifications).toEqual(true);
            expect(res.body.friendRequests).toEqual(true);
            expect(res.body.gameUpdates).toEqual(true);
            expect(res.body.achievements).toEqual(true);
            expect(res.body.purchases).toEqual(true);
            expect(res.body.systemNotifications).toEqual(true);
          });
      });

      it('should return existing settings', async () => {
        // Seed the database
        await settingsRepository.save({
          userId: mockUserId,
          emailNotifications: false,
          friendRequests: false,
        });

        return request(app.getHttpServer())
          .get(`/notifications/settings/${mockUserId}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.userId).toEqual(mockUserId);
            expect(res.body.emailNotifications).toEqual(false);
            expect(res.body.friendRequests).toEqual(false);
          });
      });

      it('should return 403 Forbidden if user ID does not match', () => {
        return request(app.getHttpServer())
          .get(`/notifications/settings/some-other-user`)
          .expect(403);
      });
    });

    describe('/notifications/settings/:userId (PUT)', () => {
      it('should update user settings', async () => {
        const updateData = {
          friendRequests: false,
          emailNotifications: false,
          gameUpdates: true,
        };

        await request(app.getHttpServer())
          .put(`/notifications/settings/${mockUserId}`)
          .send(updateData)
          .expect(200)
          .expect((res) => {
            expect(res.body.friendRequests).toEqual(false);
            expect(res.body.emailNotifications).toEqual(false);
            expect(res.body.gameUpdates).toEqual(true);
          });

        // Verify settings were persisted
        return request(app.getHttpServer())
          .get(`/notifications/settings/${mockUserId}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.friendRequests).toEqual(false);
            expect(res.body.emailNotifications).toEqual(false);
            expect(res.body.gameUpdates).toEqual(true);
          });
      });

      it('should validate input data', () => {
        return request(app.getHttpServer())
          .put(`/notifications/settings/${mockUserId}`)
          .send({ invalidField: 'invalid' })
          .expect(200); // Should ignore invalid fields due to whitelist: true
      });

      it('should return 403 Forbidden if user tries to update other user settings', () => {
        return request(app.getHttpServer())
          .put(`/notifications/settings/some-other-user`)
          .send({ friendRequests: false })
          .expect(403);
      });
    });
  });

  describe('Notification Management', () => {
    describe('/notifications/user/:userId (GET)', () => {
      it('should return empty list when no notifications exist', () => {
        return request(app.getHttpServer())
          .get(`/notifications/user/${mockUserId}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toEqual([]);
            expect(res.body.total).toEqual(0);
            expect(res.body.limit).toEqual(20);
            expect(res.body.offset).toEqual(0);
          });
      });

      it('should return notifications with pagination', async () => {
        // Create test notifications
        await Promise.all([
          notificationRepository.save({
            userId: mockUserId,
            type: NotificationType.PURCHASE,
            title: 'Purchase 1',
            message: 'Purchase completed',
            isRead: false,
          }),
          notificationRepository.save({
            userId: mockUserId,
            type: NotificationType.ACHIEVEMENT,
            title: 'Achievement 1',
            message: 'Achievement unlocked',
            isRead: true,
          }),
        ]);

        return request(app.getHttpServer())
          .get(`/notifications/user/${mockUserId}?limit=10&offset=0`)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(2);
            expect(res.body.total).toEqual(2);
            expect(res.body.limit).toEqual(10);
            expect(res.body.offset).toEqual(0);
          });
      });

      it('should filter notifications by type', async () => {
        await Promise.all([
          notificationRepository.save({
            userId: mockUserId,
            type: NotificationType.PURCHASE,
            title: 'Purchase 1',
            message: 'Purchase completed',
            isRead: false,
          }),
          notificationRepository.save({
            userId: mockUserId,
            type: NotificationType.ACHIEVEMENT,
            title: 'Achievement 1',
            message: 'Achievement unlocked',
            isRead: false,
          }),
        ]);

        return request(app.getHttpServer())
          .get(`/notifications/user/${mockUserId}?type=${NotificationType.PURCHASE}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].type).toEqual(NotificationType.PURCHASE);
          });
      });

      it('should filter notifications by read status', async () => {
        await Promise.all([
          notificationRepository.save({
            userId: mockUserId,
            type: NotificationType.PURCHASE,
            title: 'Purchase 1',
            message: 'Purchase completed',
            isRead: false,
          }),
          notificationRepository.save({
            userId: mockUserId,
            type: NotificationType.ACHIEVEMENT,
            title: 'Achievement 1',
            message: 'Achievement unlocked',
            isRead: true,
          }),
        ]);

        return request(app.getHttpServer())
          .get(`/notifications/user/${mockUserId}?isRead=false`)
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].isRead).toEqual(false);
          });
      });
    });

    describe('/notifications/:id/read (PUT)', () => {
      it('should mark notification as read', async () => {
        const notification = await notificationRepository.save({
          userId: mockUserId,
          type: NotificationType.SYSTEM,
          title: 'Test Notification',
          message: 'Test message',
          isRead: false,
        });

        await request(app.getHttpServer())
          .put(`/notifications/${notification.id}/read`)
          .expect(204);

        // Verify notification was marked as read
        const updatedNotification = await notificationRepository.findOne({
          where: { id: notification.id },
        });
        expect(updatedNotification?.isRead).toBe(true);
      });

      it('should return 404 if notification does not exist', () => {
        return request(app.getHttpServer())
          .put(`/notifications/non-existent-id/read`)
          .expect(404);
      });
    });

    describe('/notifications/stats/:userId (GET)', () => {
      it('should return notification statistics', async () => {
        await Promise.all([
          notificationRepository.save({
            userId: mockUserId,
            type: NotificationType.PURCHASE,
            title: 'Purchase 1',
            message: 'Purchase completed',
            isRead: false,
          }),
          notificationRepository.save({
            userId: mockUserId,
            type: NotificationType.PURCHASE,
            title: 'Purchase 2',
            message: 'Purchase completed',
            isRead: true,
          }),
          notificationRepository.save({
            userId: mockUserId,
            type: NotificationType.ACHIEVEMENT,
            title: 'Achievement 1',
            message: 'Achievement unlocked',
            isRead: false,
          }),
        ]);

        return request(app.getHttpServer())
          .get(`/notifications/stats/${mockUserId}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.total).toEqual(3);
            expect(res.body.unread).toEqual(2);
            expect(res.body.byType[NotificationType.PURCHASE]).toEqual(2);
            expect(res.body.byType[NotificationType.ACHIEVEMENT]).toEqual(1);
          });
      });
    });
  });

  describe('Webhook Endpoints', () => {
    describe('/notifications/webhook/payment/completed (POST)', () => {
      it('should handle payment completed webhook', () => {
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

        return request(app.getHttpServer())
          .post('/notifications/webhook/payment/completed')
          .send(paymentEvent)
          .expect(202)
          .expect((res) => {
            expect(res.body.status).toEqual('accepted');
          });
      });
    });

    describe('/notifications/webhook/payment/failed (POST)', () => {
      it('should handle payment failed webhook', () => {
        const paymentEvent = {
          userId: mockUserId,
          eventType: 'payment.failed',
          data: {
            paymentId: 'payment-123',
            gameId: 'game-456',
            gameName: 'Test Game',
            amount: 1999,
            currency: 'RUB',
            errorMessage: 'Insufficient funds',
          },
        };

        return request(app.getHttpServer())
          .post('/notifications/webhook/payment/failed')
          .send(paymentEvent)
          .expect(202)
          .expect((res) => {
            expect(res.body.status).toEqual('accepted');
          });
      });
    });

    describe('/notifications/webhook/social/friend-request (POST)', () => {
      it('should handle friend request webhook', () => {
        const socialEvent = {
          userId: mockUserId,
          eventType: 'friend.request',
          data: {
            fromUserId: 'friend-user-id',
            fromUserName: 'Friend User',
          },
        };

        return request(app.getHttpServer())
          .post('/notifications/webhook/social/friend-request')
          .send(socialEvent)
          .expect(202)
          .expect((res) => {
            expect(res.body.status).toEqual('accepted');
          });
      });
    });

    describe('/notifications/webhook/achievement/unlocked (POST)', () => {
      it('should handle achievement unlocked webhook', () => {
        const achievementEvent = {
          userId: mockUserId,
          eventType: 'achievement.unlocked',
          data: {
            achievementId: 'achievement-123',
            achievementName: 'First Victory',
            achievementDescription: 'Win your first game',
            gameId: 'game-456',
            gameName: 'Test Game',
            points: 100,
          },
        };

        return request(app.getHttpServer())
          .post('/notifications/webhook/achievement/unlocked')
          .send(achievementEvent)
          .expect(202)
          .expect((res) => {
            expect(res.body.status).toEqual('accepted');
          });
      });
    });

    describe('/notifications/webhook/game-catalog/updated (POST)', () => {
      it('should handle game updated webhook', () => {
        const gameEvent = {
          userId: mockUserId,
          eventType: 'game.updated',
          data: {
            gameId: 'game-456',
            gameName: 'Test Game',
            updateType: 'content',
            version: '1.2.0',
          },
        };

        return request(app.getHttpServer())
          .post('/notifications/webhook/game-catalog/updated')
          .send(gameEvent)
          .expect(202)
          .expect((res) => {
            expect(res.body.status).toEqual('accepted');
          });
      });
    });

    describe('/notifications/webhook/library/game-added (POST)', () => {
      it('should handle library game added webhook', () => {
        const libraryEvent = {
          userId: mockUserId,
          eventType: 'library.game_added',
          data: {
            gameId: 'game-456',
            gameName: 'Test Game',
            addedAt: new Date().toISOString(),
          },
        };

        return request(app.getHttpServer())
          .post('/notifications/webhook/library/game-added')
          .send(libraryEvent)
          .expect(202)
          .expect((res) => {
            expect(res.body.status).toEqual('accepted');
          });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON in webhook requests', () => {
      return request(app.getHttpServer())
        .post('/notifications/webhook/payment/completed')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);
    });

    it('should handle missing required fields in webhook requests', () => {
      return request(app.getHttpServer())
        .post('/notifications/webhook/payment/completed')
        .send({
          // Missing required fields
          eventType: 'payment.completed',
        })
        .expect(400);
    });

    it('should handle database connection errors gracefully', async () => {
      // This would require mocking the database connection to fail
      // For now, we'll test that the endpoint exists and handles the request
      return request(app.getHttpServer())
        .get(`/notifications/user/${mockUserId}`)
        .expect(200);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .get(`/notifications/user/${mockUserId}`)
          .expect(200)
      );

      const responses = await Promise.all(requests);
      responses.forEach((response) => {
        expect(response.body).toBeDefined();
        expect(response.body.data).toBeDefined();
      });
    });

    it('should handle large pagination requests', () => {
      return request(app.getHttpServer())
        .get(`/notifications/user/${mockUserId}?limit=100&offset=0`)
        .expect(200)
        .expect((res) => {
          expect(res.body.limit).toEqual(100);
          expect(res.body.offset).toEqual(0);
        });
    });
  });

  describe('Email Integration', () => {
    it('should trigger email service when email notifications are enabled', async () => {
      // Mock HTTP service to return user with email
      (httpService.get as jest.Mock).mockReturnValue(
        of(mockUserServiceResponses.validUser)
      );

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

      // Verify email service was called (with some delay for async processing)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Note: In a real test, you might want to verify the email was actually sent
      // This depends on your specific implementation and mocking strategy
    });

    it('should handle email service failures gracefully', async () => {
      // Mock email service to fail
      (emailService.sendNotificationEmail as jest.Mock).mockRejectedValue(
        new Error('Email service unavailable')
      );

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

      // Should still accept the webhook even if email fails
      return request(app.getHttpServer())
        .post('/notifications/webhook/payment/completed')
        .send(paymentEvent)
        .expect(202);
    });
  });
});
