import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Notification, NotificationSettings } from '../src/entities';
import { RedisCacheService } from '../src/cache/redis-cache.service';
import { EmailService } from '../src/notification/email.service';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getRepositoryToken(Notification))
      .useValue({
        create: jest.fn(),
        save: jest.fn(),
        findAndCount: jest.fn().mockResolvedValue([[], 0]),
        update: jest.fn(),
        findOne: jest.fn(),
      })
      .overrideProvider(getRepositoryToken(NotificationSettings))
      .useValue({
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
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
        sendNotificationEmail: jest.fn(),
        sendEmail: jest.fn(),
        sendEmailWithRetry: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect((res: any) => {
        expect(res.text).toContain('Notification Service API');
      });
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res: any) => {
        expect(res.body.status).toBe('ok');
        expect(res.body.service).toBe('notification-service');
      });
  });
});
