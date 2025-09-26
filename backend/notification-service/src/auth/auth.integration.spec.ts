import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Notification, NotificationSettings } from '../entities';
import { RedisCacheService } from '../cache/redis-cache.service';
import { EmailService } from '../notification/email.service';
import { NotificationModule } from '../notification/notification.module';
import { AuthModule } from './auth.module';
import { of } from 'rxjs';

describe('Authentication and Authorization (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [NotificationModule, AuthModule],
    })
      // Mock TypeORM
      .overrideProvider(getRepositoryToken(Notification))
      .useValue({
        create: jest.fn().mockImplementation((data) => ({ id: 'test-id', ...data })),
        save: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'test-id', ...data })),
        findAndCount: jest.fn().mockResolvedValue([[], 0]),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        findOne: jest.fn().mockResolvedValue(null),
      })
      .overrideProvider(getRepositoryToken(NotificationSettings))
      .useValue({
        create: jest.fn().mockImplementation((data) => ({ 
          id: 'test-settings-id', 
          userId: data.userId,
          inAppNotifications: true,
          emailNotifications: true,
          friendRequests: true,
          gameUpdates: true,
          achievements: true,
          purchases: true,
          systemNotifications: true,
          updatedAt: new Date(),
          ...data 
        })),
        save: jest.fn().mockImplementation((data) => Promise.resolve({ 
          id: 'test-settings-id', 
          userId: data.userId,
          inAppNotifications: true,
          emailNotifications: true,
          friendRequests: true,
          gameUpdates: true,
          achievements: true,
          purchases: true,
          systemNotifications: true,
          updatedAt: new Date(),
          ...data 
        })),
        findOne: jest.fn().mockImplementation(({ where }) => Promise.resolve({
          id: 'test-settings-id',
          userId: where.userId,
          inAppNotifications: true,
          emailNotifications: true,
          friendRequests: true,
          gameUpdates: true,
          achievements: true,
          purchases: true,
          systemNotifications: true,
          updatedAt: new Date(),
        })),
      })
      // Mock Cache Manager
      .overrideProvider(CACHE_MANAGER)
      .useValue({
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
      })
      // Mock Redis Cache Service
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
      // Mock Email Service
      .overrideProvider(EmailService)
      .useValue({
        sendNotificationEmail: jest.fn(),
        sendEmail: jest.fn(),
        sendEmailWithRetry: jest.fn(),
      })
      // Mock HTTP Service
      .overrideProvider(HttpService)
      .useValue({
        get: jest
          .fn()
          .mockReturnValue(of({ data: { email: 'test@test.com' } })),
        post: jest.fn().mockReturnValue(of({ data: 'ok' })),
      })
      // Mock Config Service
      .overrideProvider(ConfigService)
      .useValue({
        get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
          const config: Record<string, any> = {
            JWT_SECRET: 'test-secret-key',
            USER_SERVICE_URL: 'http://localhost:3001',
            EMAIL_PROVIDER: 'generic',
            EMAIL_URL: 'https://api.test.com/send',
            EMAIL_API_KEY: 'test-key',
            EMAIL_FROM: 'test@test.com',
          };
          return config[key] !== undefined ? config[key] : defaultValue;
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    
    // Enable CORS for testing
    app.enableCors({
      origin: ['http://localhost:3000', 'http://localhost:3001'],
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'Cache-Control',
      ],
      credentials: true,
    });
    
    await app.init();
  }, 30000);

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('JWT Authentication', () => {
    it('should reject requests without Authorization header', () => {
      return request(app.getHttpServer())
        .get('/notifications/user/test-user-id')
        .expect(401)
        .expect((res: any) => {
          expect(res.body.message).toBe('Authorization header is required');
        });
    });

    it('should reject requests with invalid Authorization header format', () => {
      return request(app.getHttpServer())
        .get('/notifications/user/test-user-id')
        .set('Authorization', 'InvalidFormat token')
        .expect(401)
        .expect((res: any) => {
          expect(res.body.message).toBe('Bearer token is required');
        });
    });

    it('should reject requests with invalid JWT token', () => {
      return request(app.getHttpServer())
        .get('/notifications/user/test-user-id')
        .set('Authorization', 'Bearer invalid')
        .expect(401)
        .expect((res: any) => {
          expect(res.body.message).toBe('Invalid JWT token');
        });
    });

    it('should accept requests with valid JWT token', () => {
      return request(app.getHttpServer())
        .get('/notifications/user/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
        .set('Authorization', 'Bearer test-user-1')
        .expect(200);
    });
  });

  describe('Authorization', () => {
    it('should allow users to access their own notifications', () => {
      return request(app.getHttpServer())
        .get('/notifications/user/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
        .set('Authorization', 'Bearer test-user-1')
        .expect(200);
    });

    it('should prevent users from accessing other users notifications', () => {
      return request(app.getHttpServer())
        .get('/notifications/user/b1ffcd99-9c0b-4ef8-bb6d-6bb9bd380a22')
        .set('Authorization', 'Bearer test-user-1')
        .expect(403)
        .expect((res: any) => {
          expect(res.body.message).toBe(
            'You can only access your own notifications',
          );
        });
    });

    it('should allow admin users to access any user notifications', () => {
      return request(app.getHttpServer())
        .get('/notifications/user/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
        .set('Authorization', 'Bearer test-admin')
        .expect(200);
    });

    it('should allow users to access their own settings', () => {
      return request(app.getHttpServer())
        .get('/notifications/settings/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
        .set('Authorization', 'Bearer test-user-1')
        .expect(200);
    });

    it('should prevent users from accessing other users settings', () => {
      return request(app.getHttpServer())
        .get('/notifications/settings/b1ffcd99-9c0b-4ef8-bb6d-6bb9bd380a22')
        .set('Authorization', 'Bearer test-user-1')
        .expect(403)
        .expect((res: any) => {
          expect(res.body.message).toBe(
            'You can only access your own settings',
          );
        });
    });
  });

  describe('Admin-only endpoints', () => {
    it('should prevent non-admin users from creating notifications directly', () => {
      return request(app.getHttpServer())
        .post('/notifications')
        .set('Authorization', 'Bearer test-user-1')
        .send({
          userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          type: 'system',
          title: 'Test notification',
          message: 'Test message',
        })
        .expect(403);
    });

    it('should allow admin users to create notifications directly', () => {
      return request(app.getHttpServer())
        .post('/notifications')
        .set('Authorization', 'Bearer test-admin')
        .send({
          userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          type: 'system',
          title: 'Test notification',
          message: 'Test message',
        })
        .expect(201);
    });

    it('should prevent non-admin users from accessing cache stats', () => {
      return request(app.getHttpServer())
        .get('/notifications/cache/stats')
        .set('Authorization', 'Bearer test-user-1')
        .expect(403);
    });

    it('should allow admin users to access cache stats', () => {
      return request(app.getHttpServer())
        .get('/notifications/cache/stats')
        .set('Authorization', 'Bearer test-admin')
        .expect(200);
    });
  });

  describe('Public endpoints (webhooks)', () => {
    it('should allow webhook endpoints without authentication', () => {
      return request(app.getHttpServer())
        .post('/notifications/webhook/payment/completed')
        .send({
          eventType: 'payment.completed',
          userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          data: {
            paymentId: 'test-payment-id',
            gameId: 'test-game-id',
            gameName: 'Test Game',
            amount: 29.99,
            currency: 'USD',
          },
        })
        .expect(202)
        .expect((res: any) => {
          expect(res.body.status).toBe('accepted');
        });
    });

    it('should allow social webhook without authentication', () => {
      return request(app.getHttpServer())
        .post('/notifications/webhook/social/friend-request')
        .send({
          eventType: 'friend.request',
          userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          data: {
            fromUserId: 'test-friend-id',
            fromUserName: 'Test Friend',
          },
        })
        .expect(202);
    });

    it('should allow achievement webhook without authentication', () => {
      return request(app.getHttpServer())
        .post('/notifications/webhook/achievement/unlocked')
        .send({
          eventType: 'achievement.unlocked',
          userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          data: {
            achievementId: 'test-achievement-id',
            achievementName: 'Test Achievement',
            achievementDescription: 'Test achievement description',
            gameId: 'test-game-id',
            gameName: 'Test Game',
            points: 100,
          },
        })
        .expect(202);
    });

    it('should allow review webhook without authentication', () => {
      return request(app.getHttpServer())
        .post('/notifications/webhook/review/created')
        .send({
          eventType: 'review.created',
          userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          data: {
            reviewId: 'test-review-id',
            gameId: 'test-game-id',
            gameName: 'Test Game',
            reviewerName: 'Test Reviewer',
            rating: 5,
          },
        })
        .expect(202);
    });
  });

  describe('CORS', () => {
    it('should handle preflight OPTIONS requests', () => {
      return request(app.getHttpServer())
        .options('/notifications/webhook/payment/completed')
        .expect(204); // OPTIONS requests typically return 204 No Content
    });

    it('should include CORS headers in responses', () => {
      return request(app.getHttpServer())
        .post('/notifications/webhook/payment/completed')
        .set('Origin', 'http://localhost:3000')
        .send({
          eventType: 'payment.completed',
          userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          data: {
            paymentId: 'test-payment-id',
            gameId: 'test-game-id',
            gameName: 'Test Game',
            amount: 29.99,
            currency: 'USD',
          },
        })
        .expect((res: any) => {
          expect(res.headers['access-control-allow-origin']).toBeDefined();
        });
    });
  });
});
