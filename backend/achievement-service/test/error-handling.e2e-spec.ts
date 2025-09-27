import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AchievementModule } from '../src/achievement/achievement.module';
import { testDatabaseConfig } from './test-database.config';
import { seedTestData, cleanupTestData } from './test-utils';
import { EventType } from '../src/achievement/dto/update-progress.dto';

describe('Error Handling and Edge Cases (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(testDatabaseConfig),
        CacheModule.register({
          ttl: 300,
          max: 100,
        }),
        AchievementModule,
      ],
    })
      .overrideProvider('APP_GUARD')
      .useValue({
        canActivate: () => true, // Mock JWT guard for testing
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    await seedTestData(dataSource);
  });

  afterAll(async () => {
    await cleanupTestData(dataSource);
    await app.close();
  });

  beforeEach(async () => {
    // Clean up user-specific data before each test
    const userAchievementRepo = dataSource.getRepository('UserAchievement');
    const userProgressRepo = dataSource.getRepository('UserProgress');
    await userProgressRepo.clear();
    await userAchievementRepo.clear();
  });

  describe('Input Validation Errors', () => {
    describe('/achievements/unlock (POST)', () => {
      it('should return 400 for missing userId', async () => {
        const response = await request(app.getHttpServer())
          .post('/achievements/unlock')
          .send({
            achievementId: '123e4567-e89b-12d3-a456-426614174001',
          })
          .expect(400);

        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('userId');
      });

      it('should return 400 for missing achievementId', async () => {
        const response = await request(app.getHttpServer())
          .post('/achievements/unlock')
          .send({
            userId: '123e4567-e89b-12d3-a456-426614174000',
          })
          .expect(400);

        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('achievementId');
      });

      it('should return 400 for invalid UUID format in userId', async () => {
        const response = await request(app.getHttpServer())
          .post('/achievements/unlock')
          .send({
            userId: 'invalid-uuid',
            achievementId: '123e4567-e89b-12d3-a456-426614174001',
          })
          .expect(400);

        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('userId');
      });

      it('should return 400 for invalid UUID format in achievementId', async () => {
        const response = await request(app.getHttpServer())
          .post('/achievements/unlock')
          .send({
            userId: '123e4567-e89b-12d3-a456-426614174000',
            achievementId: 'invalid-uuid',
          })
          .expect(400);

        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('achievementId');
      });

      it('should return 400 for extra fields in request body', async () => {
        const response = await request(app.getHttpServer())
          .post('/achievements/unlock')
          .send({
            userId: '123e4567-e89b-12d3-a456-426614174000',
            achievementId: '123e4567-e89b-12d3-a456-426614174001',
            extraField: 'should not be allowed',
          })
          .expect(400);

        expect(response.body).toHaveProperty('message');
      });

      it('should return 400 for empty request body', async () => {
        await request(app.getHttpServer()).post('/achievements/unlock').send({}).expect(400);
      });

      it('should return 400 for null values', async () => {
        await request(app.getHttpServer())
          .post('/achievements/unlock')
          .send({
            userId: null,
            achievementId: '123e4567-e89b-12d3-a456-426614174001',
          })
          .expect(400);
      });
    });

    describe('/progress/update (POST)', () => {
      it('should return 400 for invalid eventType', async () => {
        const response = await request(app.getHttpServer())
          .post('/progress/update')
          .send({
            userId: '123e4567-e89b-12d3-a456-426614174000',
            eventType: 'invalid_event_type',
            eventData: {},
          })
          .expect(400);

        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('eventType');
      });

      it('should return 400 for missing eventData', async () => {
        const response = await request(app.getHttpServer())
          .post('/progress/update')
          .send({
            userId: '123e4567-e89b-12d3-a456-426614174000',
            eventType: EventType.GAME_PURCHASE,
          })
          .expect(400);

        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('eventData');
      });

      it('should return 400 for non-object eventData', async () => {
        const response = await request(app.getHttpServer())
          .post('/progress/update')
          .send({
            userId: '123e4567-e89b-12d3-a456-426614174000',
            eventType: EventType.GAME_PURCHASE,
            eventData: 'not an object',
          })
          .expect(400);

        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('eventData');
      });
    });

    describe('URL Parameter Validation', () => {
      it('should return 400 for invalid userId in URL path', async () => {
        await request(app.getHttpServer()).get('/achievements/user/invalid-uuid').expect(400);
      });

      it('should return 400 for invalid userId in progress endpoint', async () => {
        await request(app.getHttpServer()).get('/progress/user/invalid-uuid').expect(400);
      });
    });

    describe('Query Parameter Validation', () => {
      const testUserId = '123e4567-e89b-12d3-a456-426614174000';

      it('should handle invalid page parameter gracefully', async () => {
        const response = await request(app.getHttpServer())
          .get(`/achievements/user/${testUserId}`)
          .query({ page: 'invalid' })
          .expect(200); // Should default to page 1

        expect(response.body).toHaveProperty('page');
      });

      it('should handle negative page parameter', async () => {
        const response = await request(app.getHttpServer())
          .get(`/achievements/user/${testUserId}`)
          .query({ page: -1 })
          .expect(200); // Should default to page 1

        expect(response.body.page).toBeGreaterThan(0);
      });

      it('should handle invalid limit parameter', async () => {
        const response = await request(app.getHttpServer())
          .get(`/achievements/user/${testUserId}`)
          .query({ limit: 'invalid' })
          .expect(200); // Should use default limit

        expect(response.body).toHaveProperty('limit');
      });

      it('should handle excessively large limit parameter', async () => {
        const response = await request(app.getHttpServer())
          .get(`/achievements/user/${testUserId}`)
          .query({ limit: 10000 })
          .expect(200);

        expect(response.body.limit).toBeLessThanOrEqual(100); // Should be capped
      });
    });
  });

  describe('Resource Not Found Errors', () => {
    it('should return 404 for non-existent achievement unlock', async () => {
      const response = await request(app.getHttpServer())
        .post('/achievements/unlock')
        .send({
          userId: '123e4567-e89b-12d3-a456-426614174000',
          achievementId: '123e4567-e89b-12d3-a456-426614174999', // Non-existent
        })
        .expect(404);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Achievement');
      expect(response.body.message).toContain('not found');
    });

    it('should return empty results for non-existent user achievements', async () => {
      const response = await request(app.getHttpServer())
        .get('/achievements/user/123e4567-e89b-12d3-a456-426614174999')
        .expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.total).toBe(0);
    });

    it('should return empty results for non-existent user progress', async () => {
      const response = await request(app.getHttpServer())
        .get('/progress/user/123e4567-e89b-12d3-a456-426614174999')
        .expect(200);

      expect(response.body).toHaveLength(0);
    });
  });

  describe('Conflict Errors', () => {
    const testUserId = '123e4567-e89b-12d3-a456-426614174000';
    const testAchievementId = '123e4567-e89b-12d3-a456-426614174001';

    it('should return 409 when trying to unlock already unlocked achievement', async () => {
      // First unlock
      await request(app.getHttpServer())
        .post('/achievements/unlock')
        .send({
          userId: testUserId,
          achievementId: testAchievementId,
        })
        .expect(201);

      // Try to unlock again
      const response = await request(app.getHttpServer())
        .post('/achievements/unlock')
        .send({
          userId: testUserId,
          achievementId: testAchievementId,
        })
        .expect(409);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('already unlocked');
    });
  });

  describe('Edge Cases', () => {
    const testUserId = '123e4567-e89b-12d3-a456-426614174000';

    it('should handle empty eventData object', async () => {
      const response = await request(app.getHttpServer())
        .post('/progress/update')
        .send({
          userId: testUserId,
          eventType: EventType.GAME_PURCHASE,
          eventData: {},
        })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });

    it('should handle very large eventData object', async () => {
      const largeEventData = {
        gameId: 'game-123',
        price: 1999,
        metadata: {
          description: 'A'.repeat(10000), // Very long string
          tags: Array(1000).fill('tag'), // Large array
          details: {
            level1: {
              level2: {
                level3: {
                  data: 'nested data',
                },
              },
            },
          },
        },
      };

      const response = await request(app.getHttpServer())
        .post('/progress/update')
        .send({
          userId: testUserId,
          eventType: EventType.GAME_PURCHASE,
          eventData: largeEventData,
        })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });

    it('should handle special characters in eventData', async () => {
      const specialEventData = {
        gameId: 'game-123',
        title: 'Game with special chars: àáâãäåæçèéêë',
        description: 'Description with emojis: 🎮🎯🏆',
        price: 1999,
        metadata: {
          unicode: '测试中文字符',
          symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
        },
      };

      const response = await request(app.getHttpServer())
        .post('/progress/update')
        .send({
          userId: testUserId,
          eventType: EventType.GAME_PURCHASE,
          eventData: specialEventData,
        })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });

    it('should handle concurrent requests to same endpoint', async () => {
      const promises = [];

      // Send 10 concurrent requests
      for (let i = 0; i < 10; i++) {
        promises.push(request(app.getHttpServer()).get('/achievements'));
      }

      const responses = await Promise.all(promises);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
      });
    });

    it('should handle rapid sequential progress updates', async () => {
      const promises = [];

      // Send 5 rapid sequential requests
      for (let i = 1; i <= 5; i++) {
        promises.push(
          request(app.getHttpServer())
            .post('/progress/update')
            .send({
              userId: testUserId,
              eventType: EventType.GAME_PURCHASE,
              eventData: { gameId: `game-${i}`, price: 1999 },
            }),
        );
      }

      const responses = await Promise.all(promises);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
      });

      // Verify final state
      const progressResponse = await request(app.getHttpServer())
        .get(`/progress/user/${testUserId}`)
        .expect(200);

      const gamesPurchasedProgress = progressResponse.body.find(
        p => p.achievement.type === 'games_purchased',
      );
      expect(gamesPurchasedProgress).toBeDefined();
      expect(gamesPurchasedProgress.currentValue).toBe(5);
    });
  });

  describe('Malformed Request Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app.getHttpServer())
        .post('/achievements/unlock')
        .set('Content-Type', 'application/json')
        .send('{"userId": "123e4567-e89b-12d3-a456-426614174000", "achievementId":}') // Malformed JSON
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should handle missing Content-Type header', async () => {
      const response = await request(app.getHttpServer())
        .post('/achievements/unlock')
        .send(
          'userId=123e4567-e89b-12d3-a456-426614174000&achievementId=123e4567-e89b-12d3-a456-426614174001',
        )
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should handle extremely long request URLs', async () => {
      const longUserId = '123e4567-e89b-12d3-a456-426614174000' + 'a'.repeat(1000);

      await request(app.getHttpServer()).get(`/achievements/user/${longUserId}`).expect(400);
    });
  });

  describe('HTTP Method Errors', () => {
    it('should return 405 for unsupported HTTP methods', async () => {
      await request(app.getHttpServer()).put('/achievements').expect(404); // NestJS returns 404 for unsupported routes

      await request(app.getHttpServer()).delete('/achievements').expect(404);

      await request(app.getHttpServer()).patch('/achievements').expect(404);
    });
  });

  describe('Rate Limiting Simulation', () => {
    it('should handle burst of requests gracefully', async () => {
      const promises = [];

      // Send 50 concurrent requests
      for (let i = 0; i < 50; i++) {
        promises.push(request(app.getHttpServer()).get('/achievements'));
      }

      const responses = await Promise.all(promises);

      // Most requests should succeed (some might fail due to resource limits)
      const successfulResponses = responses.filter(r => r.status === 200);
      expect(successfulResponses.length).toBeGreaterThan(40); // At least 80% should succeed
    });
  });
});
