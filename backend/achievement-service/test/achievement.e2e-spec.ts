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

describe('Achievement API (e2e)', () => {
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

  describe('/achievements (GET)', () => {
    it('should return all achievements', async () => {
      const response = await request(app.getHttpServer()).get('/achievements').expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body).toHaveLength(3);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[0]).toHaveProperty('description');
      expect(response.body[0]).toHaveProperty('type');
      expect(response.body[0]).toHaveProperty('condition');
      expect(response.body[0]).toHaveProperty('points');
    });

    it('should return cached results on subsequent requests', async () => {
      // First request
      const response1 = await request(app.getHttpServer()).get('/achievements').expect(200);

      // Second request should be faster (cached)
      const response2 = await request(app.getHttpServer()).get('/achievements').expect(200);

      expect(response1.body).toEqual(response2.body);
    });
  });

  describe('/achievements/user/:userId (GET)', () => {
    const testUserId = '123e4567-e89b-12d3-a456-426614174000';

    it('should return empty list for user with no achievements', async () => {
      const response = await request(app.getHttpServer())
        .get(`/achievements/user/${testUserId}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data).toHaveLength(0);
      expect(response.body.total).toBe(0);
    });

    it('should return user achievements with pagination', async () => {
      // First unlock an achievement
      await request(app.getHttpServer())
        .post('/achievements/unlock')
        .send({
          userId: testUserId,
          achievementId: '123e4567-e89b-12d3-a456-426614174001',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/achievements/user/${testUserId}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.total).toBe(1);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
      expect(response.body.data[0]).toHaveProperty('achievement');
      expect(response.body.data[0]).toHaveProperty('unlockedAt');
    });

    it('should filter achievements by type', async () => {
      // Unlock achievements of different types
      await request(app.getHttpServer())
        .post('/achievements/unlock')
        .send({
          userId: testUserId,
          achievementId: '123e4567-e89b-12d3-a456-426614174001', // FIRST_PURCHASE
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/achievements/unlock')
        .send({
          userId: testUserId,
          achievementId: '123e4567-e89b-12d3-a456-426614174002', // FIRST_REVIEW
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/achievements/user/${testUserId}`)
        .query({ type: 'first_purchase' })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].achievement.type).toBe('first_purchase');
    });

    it('should return 400 for invalid userId format', async () => {
      await request(app.getHttpServer()).get('/achievements/user/invalid-uuid').expect(400);
    });
  });

  describe('/achievements/unlock (POST)', () => {
    const testUserId = '123e4567-e89b-12d3-a456-426614174000';
    const testAchievementId = '123e4567-e89b-12d3-a456-426614174001';

    it('should unlock achievement successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/achievements/unlock')
        .send({
          userId: testUserId,
          achievementId: testAchievementId,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('userId', testUserId);
      expect(response.body).toHaveProperty('achievement');
      expect(response.body).toHaveProperty('unlockedAt');
      expect(response.body.achievement.id).toBe(testAchievementId);
    });

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
      await request(app.getHttpServer())
        .post('/achievements/unlock')
        .send({
          userId: testUserId,
          achievementId: testAchievementId,
        })
        .expect(409);
    });

    it('should return 404 for non-existent achievement', async () => {
      await request(app.getHttpServer())
        .post('/achievements/unlock')
        .send({
          userId: testUserId,
          achievementId: '123e4567-e89b-12d3-a456-426614174999',
        })
        .expect(404);
    });

    it('should return 400 for invalid request body', async () => {
      await request(app.getHttpServer())
        .post('/achievements/unlock')
        .send({
          userId: 'invalid-uuid',
          achievementId: testAchievementId,
        })
        .expect(400);

      await request(app.getHttpServer())
        .post('/achievements/unlock')
        .send({
          userId: testUserId,
          // missing achievementId
        })
        .expect(400);
    });
  });

  describe('/progress/user/:userId (GET)', () => {
    const testUserId = '123e4567-e89b-12d3-a456-426614174000';

    it('should return empty progress for user with no progress', async () => {
      const response = await request(app.getHttpServer())
        .get(`/progress/user/${testUserId}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body).toHaveLength(0);
    });

    it('should return user progress after updating', async () => {
      // Update progress first
      await request(app.getHttpServer())
        .post('/progress/update')
        .send({
          userId: testUserId,
          eventType: EventType.GAME_PURCHASE,
          eventData: { gameId: 'game-123', price: 1999 },
        })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/progress/user/${testUserId}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('currentValue');
      expect(response.body[0]).toHaveProperty('targetValue');
      expect(response.body[0]).toHaveProperty('progressPercentage');
      expect(response.body[0]).toHaveProperty('achievement');
    });
  });

  describe('/progress/update (POST)', () => {
    const testUserId = '123e4567-e89b-12d3-a456-426614174000';

    it('should update progress for game purchase event', async () => {
      const response = await request(app.getHttpServer())
        .post('/progress/update')
        .send({
          userId: testUserId,
          eventType: EventType.GAME_PURCHASE,
          eventData: { gameId: 'game-123', price: 1999 },
        })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);

      // Check if progress was updated
      const progressItem = response.body.find(p => p.achievement.type === 'first_purchase');
      expect(progressItem).toBeDefined();
      expect(progressItem.currentValue).toBe(1);
    });

    it('should update progress for review created event', async () => {
      const response = await request(app.getHttpServer())
        .post('/progress/update')
        .send({
          userId: testUserId,
          eventType: EventType.REVIEW_CREATED,
          eventData: { reviewId: 'review-123', gameId: 'game-123', rating: 5 },
        })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);

      // Check if progress was updated
      const progressItem = response.body.find(p => p.achievement.type === 'first_review');
      expect(progressItem).toBeDefined();
      expect(progressItem.currentValue).toBe(1);
    });

    it('should update progress for friend added event', async () => {
      const response = await request(app.getHttpServer())
        .post('/progress/update')
        .send({
          userId: testUserId,
          eventType: EventType.FRIEND_ADDED,
          eventData: { friendId: 'friend-123' },
        })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);

      // Check if progress was updated
      const progressItem = response.body.find(p => p.achievement.type === 'first_friend');
      expect(progressItem).toBeDefined();
      expect(progressItem.currentValue).toBe(1);
    });

    it('should return 400 for invalid event type', async () => {
      await request(app.getHttpServer())
        .post('/progress/update')
        .send({
          userId: testUserId,
          eventType: 'invalid_event',
          eventData: {},
        })
        .expect(400);
    });

    it('should return 400 for invalid request body', async () => {
      await request(app.getHttpServer())
        .post('/progress/update')
        .send({
          userId: 'invalid-uuid',
          eventType: EventType.GAME_PURCHASE,
          eventData: {},
        })
        .expect(400);

      await request(app.getHttpServer())
        .post('/progress/update')
        .send({
          userId: testUserId,
          // missing eventType
          eventData: {},
        })
        .expect(400);
    });
  });

  describe('Full Achievement Flow (Integration)', () => {
    const testUserId = '123e4567-e89b-12d3-a456-426614174000';

    it('should complete full flow: event → progress update → achievement unlock', async () => {
      // Step 1: Update progress with game purchase event
      const progressResponse = await request(app.getHttpServer())
        .post('/progress/update')
        .send({
          userId: testUserId,
          eventType: EventType.GAME_PURCHASE,
          eventData: { gameId: 'game-123', price: 1999 },
        })
        .expect(200);

      // Verify progress was updated
      const firstPurchaseProgress = progressResponse.body.find(
        p => p.achievement.type === 'first_purchase',
      );
      expect(firstPurchaseProgress).toBeDefined();
      expect(firstPurchaseProgress.currentValue).toBe(1);
      expect(firstPurchaseProgress.progressPercentage).toBe(100);

      // Step 2: Check if achievement was automatically unlocked
      const userAchievementsResponse = await request(app.getHttpServer())
        .get(`/achievements/user/${testUserId}`)
        .expect(200);

      expect(userAchievementsResponse.body.total).toBe(1);
      expect(userAchievementsResponse.body.data[0].achievement.type).toBe('first_purchase');

      // Step 3: Verify progress tracking for count-based achievements
      for (let i = 2; i <= 5; i++) {
        await request(app.getHttpServer())
          .post('/progress/update')
          .send({
            userId: testUserId,
            eventType: EventType.GAME_PURCHASE,
            eventData: { gameId: `game-${i}`, price: 1999 },
          })
          .expect(200);
      }

      // Check if "5 games" achievement was unlocked
      const finalAchievementsResponse = await request(app.getHttpServer())
        .get(`/achievements/user/${testUserId}`)
        .expect(200);

      expect(finalAchievementsResponse.body.total).toBe(2); // first_purchase + games_purchased
      const fiveGamesAchievement = finalAchievementsResponse.body.data.find(
        a => a.achievement.type === 'games_purchased',
      );
      expect(fiveGamesAchievement).toBeDefined();
    });

    it('should handle multiple concurrent progress updates correctly', async () => {
      const promises = [];

      // Send multiple concurrent requests
      for (let i = 1; i <= 3; i++) {
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
      });

      // Check final progress
      const progressResponse = await request(app.getHttpServer())
        .get(`/progress/user/${testUserId}`)
        .expect(200);

      const gamesPurchasedProgress = progressResponse.body.find(
        p => p.achievement.type === 'games_purchased',
      );
      expect(gamesPurchasedProgress).toBeDefined();
      expect(gamesPurchasedProgress.currentValue).toBe(3);
    });
  });
});
