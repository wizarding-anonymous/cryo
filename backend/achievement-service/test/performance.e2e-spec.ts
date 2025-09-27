import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AchievementModule } from '../src/achievement/achievement.module';
import { testDatabaseConfig } from './test-database.config';
import { TestDataFactory, cleanupTestData } from './test-utils';
import { Achievement } from '../src/achievement/entities/achievement.entity';
import { UserAchievement } from '../src/achievement/entities/user-achievement.entity';
import { UserProgress } from '../src/achievement/entities/user-progress.entity';
import { AchievementType } from '../src/achievement/entities/achievement.entity';

describe('Performance Tests (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(testDatabaseConfig),
        CacheModule.register({
          ttl: 300,
          max: 1000,
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
  });

  afterAll(async () => {
    await cleanupTestData(dataSource);
    await app.close();
  });

  beforeEach(async () => {
    await cleanupTestData(dataSource);
  });

  describe('Large Dataset Performance', () => {
    it('should handle 100 achievements efficiently', async () => {
      // Create 100 achievements
      const achievements: Achievement[] = [];
      for (let i = 1; i <= 100; i++) {
        achievements.push(
          TestDataFactory.createTestAchievement({
            id: `achievement-${i.toString().padStart(3, '0')}`,
            name: `Achievement ${i}`,
            description: `Description for achievement ${i}`,
            type: i % 2 === 0 ? AchievementType.FIRST_PURCHASE : AchievementType.FIRST_REVIEW,
            points: i * 10,
          }),
        );
      }

      const achievementRepo = dataSource.getRepository(Achievement);
      await achievementRepo.save(achievements);

      const startTime = Date.now();
      const response = await request(app.getHttpServer()).get('/achievements').expect(200);
      const endTime = Date.now();

      expect(response.body).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle user with 50 unlocked achievements efficiently', async () => {
      const testUserId = '123e4567-e89b-12d3-a456-426614174000';

      // Create 50 achievements
      const achievements: Achievement[] = [];
      for (let i = 1; i <= 50; i++) {
        achievements.push(
          TestDataFactory.createTestAchievement({
            id: `achievement-${i.toString().padStart(3, '0')}`,
            name: `Achievement ${i}`,
            description: `Description for achievement ${i}`,
            type: AchievementType.FIRST_PURCHASE,
            points: i * 10,
          }),
        );
      }

      const achievementRepo = dataSource.getRepository(Achievement);
      await achievementRepo.save(achievements);

      // Create 50 user achievements
      const userAchievements: UserAchievement[] = [];
      for (let i = 1; i <= 50; i++) {
        userAchievements.push(
          TestDataFactory.createTestUserAchievement({
            id: `user-achievement-${i.toString().padStart(3, '0')}`,
            userId: testUserId,
            achievementId: `achievement-${i.toString().padStart(3, '0')}`,
            unlockedAt: new Date(Date.now() - i * 1000 * 60 * 60), // Spread over hours
          }),
        );
      }

      const userAchievementRepo = dataSource.getRepository(UserAchievement);
      await userAchievementRepo.save(userAchievements);

      const startTime = Date.now();
      const response = await request(app.getHttpServer())
        .get(`/achievements/user/${testUserId}`)
        .expect(200);
      const endTime = Date.now();

      expect(response.body.total).toBe(50);
      expect(response.body.data).toHaveLength(20); // Default limit
      expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
    });

    it('should handle pagination efficiently with large dataset', async () => {
      const testUserId = '123e4567-e89b-12d3-a456-426614174000';

      // Create 100 achievements
      const achievements: Achievement[] = [];
      for (let i = 1; i <= 100; i++) {
        achievements.push(
          TestDataFactory.createTestAchievement({
            id: `achievement-${i.toString().padStart(3, '0')}`,
            name: `Achievement ${i}`,
            description: `Description for achievement ${i}`,
            type: AchievementType.FIRST_PURCHASE,
            points: i * 10,
          }),
        );
      }

      const achievementRepo = dataSource.getRepository(Achievement);
      await achievementRepo.save(achievements);

      // Create 100 user achievements
      const userAchievements: UserAchievement[] = [];
      for (let i = 1; i <= 100; i++) {
        userAchievements.push(
          TestDataFactory.createTestUserAchievement({
            id: `user-achievement-${i.toString().padStart(3, '0')}`,
            userId: testUserId,
            achievementId: `achievement-${i.toString().padStart(3, '0')}`,
            unlockedAt: new Date(Date.now() - i * 1000 * 60 * 60),
          }),
        );
      }

      const userAchievementRepo = dataSource.getRepository(UserAchievement);
      await userAchievementRepo.save(userAchievements);

      // Test different page sizes
      const pageSizes = [10, 25, 50];

      for (const pageSize of pageSizes) {
        const startTime = Date.now();
        const response = await request(app.getHttpServer())
          .get(`/achievements/user/${testUserId}`)
          .query({ page: 1, limit: pageSize })
          .expect(200);
        const endTime = Date.now();

        expect(response.body.data).toHaveLength(pageSize);
        expect(response.body.total).toBe(100);
        expect(endTime - startTime).toBeLessThan(300); // Should complete within 300ms
      }
    });

    it('should handle multiple concurrent progress updates efficiently', async () => {
      const testUserId = '123e4567-e89b-12d3-a456-426614174000';

      // Create achievements
      const achievements: Achievement[] = [];
      for (let i = 1; i <= 10; i++) {
        achievements.push(
          TestDataFactory.createTestAchievement({
            id: `achievement-${i.toString().padStart(3, '0')}`,
            name: `Achievement ${i}`,
            description: `Description for achievement ${i}`,
            type: AchievementType.GAMES_PURCHASED,
            condition: { type: 'count', target: i * 5 },
            points: i * 10,
          }),
        );
      }

      const achievementRepo = dataSource.getRepository(Achievement);
      await achievementRepo.save(achievements);

      // Send 20 concurrent progress update requests
      const promises = [];
      const startTime = Date.now();

      for (let i = 1; i <= 20; i++) {
        promises.push(
          request(app.getHttpServer())
            .post('/progress/update')
            .send({
              userId: testUserId,
              eventType: 'game_purchase',
              eventData: { gameId: `game-${i}`, price: 1999 },
            }),
        );
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle large progress tracking dataset efficiently', async () => {
      const testUserId = '123e4567-e89b-12d3-a456-426614174000';

      // Create 50 achievements
      const achievements: Achievement[] = [];
      for (let i = 1; i <= 50; i++) {
        achievements.push(
          TestDataFactory.createTestAchievement({
            id: `achievement-${i.toString().padStart(3, '0')}`,
            name: `Achievement ${i}`,
            description: `Description for achievement ${i}`,
            type: AchievementType.GAMES_PURCHASED,
            condition: { type: 'count', target: i },
            points: i * 10,
          }),
        );
      }

      const achievementRepo = dataSource.getRepository(Achievement);
      await achievementRepo.save(achievements);

      // Create 50 progress entries
      const progressEntries: UserProgress[] = [];
      for (let i = 1; i <= 50; i++) {
        progressEntries.push(
          TestDataFactory.createTestUserProgress({
            id: `progress-${i.toString().padStart(3, '0')}`,
            userId: testUserId,
            achievementId: `achievement-${i.toString().padStart(3, '0')}`,
            currentValue: Math.floor(i / 2),
            targetValue: i,
          }),
        );
      }

      const progressRepo = dataSource.getRepository(UserProgress);
      await progressRepo.save(progressEntries);

      const startTime = Date.now();
      const response = await request(app.getHttpServer())
        .get(`/progress/user/${testUserId}`)
        .expect(200);
      const endTime = Date.now();

      expect(response.body).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
    });
  });

  describe('Cache Performance', () => {
    it('should demonstrate cache effectiveness for achievements endpoint', async () => {
      // Create 50 achievements
      const achievements: Achievement[] = [];
      for (let i = 1; i <= 50; i++) {
        achievements.push(
          TestDataFactory.createTestAchievement({
            id: `achievement-${i.toString().padStart(3, '0')}`,
            name: `Achievement ${i}`,
            description: `Description for achievement ${i}`,
            type: AchievementType.FIRST_PURCHASE,
            points: i * 10,
          }),
        );
      }

      const achievementRepo = dataSource.getRepository(Achievement);
      await achievementRepo.save(achievements);

      // First request (cache miss)
      const startTime1 = Date.now();
      const response1 = await request(app.getHttpServer()).get('/achievements').expect(200);
      const endTime1 = Date.now();
      const firstRequestTime = endTime1 - startTime1;

      // Second request (cache hit)
      const startTime2 = Date.now();
      const response2 = await request(app.getHttpServer()).get('/achievements').expect(200);
      const endTime2 = Date.now();
      const secondRequestTime = endTime2 - startTime2;

      expect(response1.body).toEqual(response2.body);
      expect(secondRequestTime).toBeLessThan(firstRequestTime); // Cache should be faster
      expect(secondRequestTime).toBeLessThan(100); // Cached response should be very fast
    });
  });

  describe('Database Query Optimization', () => {
    it('should efficiently query user achievements with joins', async () => {
      const testUserId = '123e4567-e89b-12d3-a456-426614174000';

      // Create 30 achievements
      const achievements: Achievement[] = [];
      for (let i = 1; i <= 30; i++) {
        achievements.push(
          TestDataFactory.createTestAchievement({
            id: `achievement-${i.toString().padStart(3, '0')}`,
            name: `Achievement ${i}`,
            description: `Description for achievement ${i}`,
            type:
              i % 3 === 0
                ? AchievementType.FIRST_PURCHASE
                : i % 3 === 1
                  ? AchievementType.FIRST_REVIEW
                  : AchievementType.GAMES_PURCHASED,
            points: i * 10,
          }),
        );
      }

      const achievementRepo = dataSource.getRepository(Achievement);
      await achievementRepo.save(achievements);

      // Create 30 user achievements
      const userAchievements: UserAchievement[] = [];
      for (let i = 1; i <= 30; i++) {
        userAchievements.push(
          TestDataFactory.createTestUserAchievement({
            id: `user-achievement-${i.toString().padStart(3, '0')}`,
            userId: testUserId,
            achievementId: `achievement-${i.toString().padStart(3, '0')}`,
            unlockedAt: new Date(Date.now() - i * 1000 * 60),
          }),
        );
      }

      const userAchievementRepo = dataSource.getRepository(UserAchievement);
      await userAchievementRepo.save(userAchievements);

      // Test query with joins
      const startTime = Date.now();
      const response = await request(app.getHttpServer())
        .get(`/achievements/user/${testUserId}`)
        .query({ limit: 30 })
        .expect(200);
      const endTime = Date.now();

      expect(response.body.data).toHaveLength(30);
      expect(response.body.total).toBe(30);
      expect(endTime - startTime).toBeLessThan(400); // Should complete within 400ms

      // Verify that achievement data is properly joined
      response.body.data.forEach(item => {
        expect(item).toHaveProperty('achievement');
        expect(item.achievement).toHaveProperty('name');
        expect(item.achievement).toHaveProperty('description');
        expect(item.achievement).toHaveProperty('points');
      });
    });
  });
});
