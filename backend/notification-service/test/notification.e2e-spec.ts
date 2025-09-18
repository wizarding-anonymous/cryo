import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationSettings } from '../src/entities';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';

describe('NotificationController (e2e)', () => {
  let app: INestApplication;
  let settingsRepository: Repository<NotificationSettings>;
  const mockUserId = 'e2e-user-123';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context) => {
          const request = context.switchToHttp().getRequest();
          request.user = { id: mockUserId };
          return true;
        },
      })
      .overrideProvider(HttpService) // Mock HttpService to prevent real external calls
      .useValue({
        get: jest.fn().mockReturnValue(of({ data: { email: 'test@test.com' } })),
        post: jest.fn().mockReturnValue(of({ data: 'ok' })),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    settingsRepository = moduleFixture.get<Repository<NotificationSettings>>(
      getRepositoryToken(NotificationSettings),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up database before each test
    await settingsRepository.delete({ userId: mockUserId });
  });

  describe('/notifications/settings/:userId (GET)', () => {
    it('should create and return default settings if none exist', () => {
      return request(app.getHttpServer())
        .get(`/notifications/settings/${mockUserId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toBeDefined();
          expect(res.body.userId).toEqual(mockUserId);
          expect(res.body.emailNotifications).toEqual(true);
        });
    });

    it('should return existing settings', async () => {
      // Seed the database
      await settingsRepository.save({
        userId: mockUserId,
        emailNotifications: false,
      });

      return request(app.getHttpServer())
        .get(`/notifications/settings/${mockUserId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.userId).toEqual(mockUserId);
          expect(res.body.emailNotifications).toEqual(false);
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
      await request(app.getHttpServer())
        .put(`/notifications/settings/${mockUserId}`)
        .send({ friendRequests: false })
        .expect(200);

      return request(app.getHttpServer())
        .get(`/notifications/settings/${mockUserId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.friendRequests).toEqual(false);
        });
    });
  });
});
