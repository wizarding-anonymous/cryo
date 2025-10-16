import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';

import { TestAppModule } from './test-app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { HttpAdapterHost } from '@nestjs/core';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

describe('Profile Endpoints (e2e)', () => {
  let app: INestApplication;
  let testUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply the same global pipes, filters, and interceptors as in main.ts
    const httpAdapterHost = app.get(HttpAdapterHost);
    app.useGlobalFilters(new GlobalExceptionFilter(httpAdapterHost));
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    // Create a test user for profile operations
    const createUserResponse = await request(app.getHttpServer())
      .post('/api/users')
      .send({
        name: 'Profile Test User',
        email: `profile-test-${Date.now()}@example.com`,
        password: 'hashedPassword123',
      });

    testUserId = createUserResponse.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Profile Management', () => {
    it('GET /api/profiles/:userId - should get user profile', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/profiles/${testUserId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testUserId);
      expect(response.body).toHaveProperty('name', 'Profile Test User');
      expect(response.body).not.toHaveProperty('password');
    });

    it('GET /api/profiles/:userId - should return 404 for non-existent user', async () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174000';
      await request(app.getHttpServer())
        .get(`/api/profiles/${nonExistentId}`)
        .expect(404);
    });

    it('PATCH /api/profiles/:userId - should update user profile', async () => {
      const updateData = {
        name: 'Updated Profile Name',
        preferences: {
          language: 'ru',
          theme: 'dark',
          timezone: 'Europe/Moscow',
          notifications: {
            email: true,
            push: false,
            sms: false,
          },
          gameSettings: {
            autoDownload: false,
            cloudSave: true,
            achievementNotifications: true,
          },
        },
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/profiles/${testUserId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe('Updated Profile Name');
      expect(response.body.preferences.language).toBe('ru');
      expect(response.body.preferences.theme).toBe('dark');
    });

    it('PATCH /api/profiles/:userId - should validate profile data', async () => {
      const invalidData = {
        name: '', // Empty name should fail validation
        avatarUrl: 'not-a-valid-url',
      };

      await request(app.getHttpServer())
        .patch(`/api/profiles/${testUserId}`)
        .send(invalidData)
        .expect(400);
    });
  });

  describe('Avatar Management', () => {
    it('POST /api/profiles/:userId/avatar - should upload avatar', async () => {
      // Create a small test image buffer (1x1 pixel PNG)
      const testImageBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
        0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0x57, 0x63, 0xf8, 0x0f, 0x00, 0x00,
        0x01, 0x00, 0x01, 0x5c, 0xc2, 0x8a, 0x8e, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);

      const response = await request(app.getHttpServer())
        .post(`/api/profiles/${testUserId}/avatar`)
        .attach('avatar', testImageBuffer, 'test-avatar.png')
        .expect(201);

      expect(response.body).toHaveProperty('avatarUrl');
      expect(response.body).toHaveProperty(
        'message',
        'Аватар успешно загружен',
      );
      expect(response.body.avatarUrl).toMatch(/\/uploads\/avatars\/.+\.png$/);
    });

    it('POST /api/profiles/:userId/avatar - should reject invalid file types', async () => {
      const textBuffer = Buffer.from('This is not an image');

      await request(app.getHttpServer())
        .post(`/api/profiles/${testUserId}/avatar`)
        .attach('avatar', textBuffer, 'test.txt')
        .expect(400);
    });

    it('DELETE /api/profiles/:userId/avatar - should delete avatar', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/profiles/${testUserId}/avatar`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Аватар успешно удален');
    });

    it('DELETE /api/profiles/:userId/avatar - should fail when no avatar exists', async () => {
      await request(app.getHttpServer())
        .delete(`/api/profiles/${testUserId}/avatar`)
        .expect(400);
    });
  });

  describe('Preferences Management', () => {
    it('GET /api/profiles/:userId/preferences - should get user preferences', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/profiles/${testUserId}/preferences`)
        .expect(200);

      if (response.body) {
        expect(response.body).toHaveProperty('language');
        expect(response.body).toHaveProperty('theme');
      }
    });

    it('PATCH /api/profiles/:userId/preferences - should update preferences', async () => {
      const preferencesUpdate = {
        language: 'en',
        theme: 'light',
        timezone: 'America/New_York',
        notifications: {
          email: false,
          push: true,
          sms: false,
        },
        gameSettings: {
          autoDownload: true,
          cloudSave: false,
          achievementNotifications: false,
        },
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/profiles/${testUserId}/preferences`)
        .send(preferencesUpdate)
        .expect(200);

      expect(response.body.language).toBe('en');
      expect(response.body.theme).toBe('light');
      expect(response.body.notifications.email).toBe(false);
      expect(response.body.gameSettings.autoDownload).toBe(true);
    });

    it('PATCH /api/profiles/:userId/preferences - should validate theme values', async () => {
      const invalidPreferences = {
        theme: 'invalid-theme',
      };

      await request(app.getHttpServer())
        .patch(`/api/profiles/${testUserId}/preferences`)
        .send(invalidPreferences)
        .expect(400);
    });
  });

  describe('Privacy Settings Management', () => {
    it('GET /api/profiles/:userId/privacy-settings - should get privacy settings', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/profiles/${testUserId}/privacy-settings`)
        .expect(200);

      if (response.body) {
        expect(response.body).toHaveProperty('profileVisibility');
        expect(response.body).toHaveProperty('showOnlineStatus');
      }
    });

    it('PATCH /api/profiles/:userId/privacy-settings - should update privacy settings', async () => {
      const privacyUpdate = {
        profileVisibility: 'friends',
        showOnlineStatus: false,
        showGameActivity: false,
        allowFriendRequests: true,
        showAchievements: false,
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/profiles/${testUserId}/privacy-settings`)
        .send(privacyUpdate)
        .expect(200);

      expect(response.body.profileVisibility).toBe('friends');
      expect(response.body.showOnlineStatus).toBe(false);
      expect(response.body.showGameActivity).toBe(false);
      expect(response.body.allowFriendRequests).toBe(true);
      expect(response.body.showAchievements).toBe(false);
    });

    it('PATCH /api/profiles/:userId/privacy-settings - should validate visibility values', async () => {
      const invalidPrivacy = {
        profileVisibility: 'invalid-visibility',
      };

      await request(app.getHttpServer())
        .patch(`/api/profiles/${testUserId}/privacy-settings`)
        .send(invalidPrivacy)
        .expect(400);
    });
  });

  describe('UUID Validation', () => {
    it('should return 400 for invalid UUID format', async () => {
      await request(app.getHttpServer())
        .get('/api/profiles/invalid-uuid')
        .expect(400);
    });
  });
});
