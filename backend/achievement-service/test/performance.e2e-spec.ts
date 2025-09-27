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
      response.body.data.forEach((item: any) => {
        expect(item).toHaveProperty('achievement');
        expect(item.achievement).toHaveProperty('name');
        expect(item.achievement).toHaveProperty('description');
        expect(item.achievement).toHaveProperty('points');
      });
    });
  });

  describe('Stress Testing with Large Datasets', () => {
    it('should handle 1000+ concurrent progress updates', async () => {
      const userCount = 50;
      const eventsPerUser = 20;
      const totalEvents = userCount * eventsPerUser;

      // Create test achievements first
      const achievements: Achievement[] = [];
      for (let i = 1; i <= 10; i++) {
        achievements.push(
          TestDataFactory.createTestAchievement({
            id: `achievement-${i.toString().padStart(3, '0')}`,
            name: `Achievement ${i}`,
            description: `Description for achievement ${i}`,
            type: AchievementType.GAMES_PURCHASED,
            condition: { type: 'count', target: i * 2 },
            points: i * 10,
          }),
        );
      }

      const achievementRepo = dataSource.getRepository(Achievement);
      await achievementRepo.save(achievements);

      const promises = [];
      const startTime = Date.now();

      // Generate concurrent requests
      for (let userId = 1; userId <= userCount; userId++) {
        for (let eventId = 1; eventId <= eventsPerUser; eventId++) {
          promises.push(
            request(app.getHttpServer())
              .post('/progress/update')
              .send({
                userId: `user-${userId.toString().padStart(3, '0')}`,
                eventType: 'game_purchase',
                eventData: {
                  gameId: `game-${eventId}`,
                  price: 1999,
                  timestamp: new Date().toISOString(),
                },
              }),
          );
        }
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      const successfulResponses = responses.filter(r => r.status === 200);
      expect(successfulResponses.length).toBe(totalEvents);

      // Should complete within reasonable time (adjust based on your requirements)
      expect(totalTime).toBeLessThan(30000); // 30 seconds for 1000 events

      console.log(
        `Processed ${totalEvents} events in ${totalTime}ms (${((totalEvents / totalTime) * 1000).toFixed(2)} events/sec)`,
      );

      // Verify data consistency for a sample of users
      for (let userId = 1; userId <= Math.min(5, userCount); userId++) {
        const userIdStr = `user-${userId.toString().padStart(3, '0')}`;
        const progress = await request(app.getHttpServer())
          .get(`/progress/user/${userIdStr}`)
          .expect(200);

        expect(progress.body.length).toBeGreaterThan(0);

        // Check that progress values are consistent
        const gamesProgress = progress.body.find(
          (p: any) => p.achievement.type === 'games_purchased',
        );
        if (gamesProgress) {
          expect(gamesProgress.currentValue).toBe(eventsPerUser);
        }
      }
    });

    it('should handle burst traffic patterns', async () => {
      const burstSize = 100;
      const burstCount = 5;
      const delayBetweenBursts = 1000; // 1 second

      // Create test achievements
      const achievements: Achievement[] = [];
      for (let i = 1; i <= 5; i++) {
        achievements.push(
          TestDataFactory.createTestAchievement({
            id: `achievement-${i.toString().padStart(3, '0')}`,
            name: `Achievement ${i}`,
            description: `Description for achievement ${i}`,
            type: AchievementType.GAMES_PURCHASED,
            condition: { type: 'count', target: i * 10 },
            points: i * 10,
          }),
        );
      }

      const achievementRepo = dataSource.getRepository(Achievement);
      await achievementRepo.save(achievements);

      const allResponseTimes = [];

      for (let burst = 1; burst <= burstCount; burst++) {
        const promises = [];
        const burstStartTime = Date.now();

        // Create burst of requests
        for (let i = 1; i <= burstSize; i++) {
          promises.push(
            request(app.getHttpServer())
              .post('/progress/update')
              .send({
                userId: `user-${(burst * 100 + i).toString().padStart(4, '0')}`,
                eventType: 'game_purchase',
                eventData: { gameId: `game-${i}`, price: 1999 },
              }),
          );
        }

        const responses = await Promise.all(promises);
        const burstEndTime = Date.now();
        const burstTime = burstEndTime - burstStartTime;

        allResponseTimes.push(burstTime);

        // All requests in burst should succeed
        const successfulResponses = responses.filter(r => r.status === 200);
        expect(successfulResponses.length).toBe(burstSize);

        console.log(`Burst ${burst}: ${burstSize} requests in ${burstTime}ms`);

        // Wait between bursts (except for the last one)
        if (burst < burstCount) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBursts));
        }
      }

      // Verify system maintained performance across bursts
      const avgResponseTime = allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length;
      const maxResponseTime = Math.max(...allResponseTimes);

      expect(avgResponseTime).toBeLessThan(5000); // Average burst should complete within 5 seconds
      expect(maxResponseTime).toBeLessThan(10000); // No burst should take more than 10 seconds

      console.log(`Average burst time: ${avgResponseTime.toFixed(2)}ms, Max: ${maxResponseTime}ms`);
    });

    it('should maintain performance with large user base', async () => {
      const userCount = 1000;
      const achievementsPerUser = 10;

      // Create achievements
      const achievements: Achievement[] = [];
      for (let i = 1; i <= 20; i++) {
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

      // Create user achievements for many users
      const userAchievements: UserAchievement[] = [];
      for (let userId = 1; userId <= userCount; userId++) {
        for (let achId = 1; achId <= achievementsPerUser; achId++) {
          userAchievements.push(
            TestDataFactory.createTestUserAchievement({
              id: `user-ach-${userId}-${achId}`,
              userId: `user-${userId.toString().padStart(4, '0')}`,
              achievementId: `achievement-${achId.toString().padStart(3, '0')}`,
              unlockedAt: new Date(Date.now() - achId * 1000 * 60),
            }),
          );
        }
      }

      // Insert in batches to avoid memory issues
      const batchSize = 1000;
      const userAchievementRepo = dataSource.getRepository(UserAchievement);

      for (let i = 0; i < userAchievements.length; i += batchSize) {
        const batch = userAchievements.slice(i, i + batchSize);
        await userAchievementRepo.save(batch);
      }

      // Test query performance with large dataset
      const testUserIds = ['user-0001', 'user-0500', 'user-1000'];

      const queryTimes = [];

      for (const userId of testUserIds) {
        const startTime = Date.now();
        const response = await request(app.getHttpServer())
          .get(`/achievements/user/${userId}`)
          .query({ limit: 20 })
          .expect(200);
        const endTime = Date.now();

        const queryTime = endTime - startTime;
        queryTimes.push(queryTime);

        expect(response.body.data).toHaveLength(achievementsPerUser);
        expect(response.body.total).toBe(achievementsPerUser);
        expect(queryTime).toBeLessThan(1000); // Should complete within 1 second even with large dataset
      }

      const avgQueryTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
      console.log(`Average query time with ${userCount} users: ${avgQueryTime.toFixed(2)}ms`);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should handle large progress tracking datasets efficiently', async () => {
      const userCount = 100;
      const progressEntriesPerUser = 50;

      // Create achievements
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

      // Create progress entries
      const progressEntries: UserProgress[] = [];
      for (let userId = 1; userId <= userCount; userId++) {
        for (let progId = 1; progId <= progressEntriesPerUser; progId++) {
          progressEntries.push(
            TestDataFactory.createTestUserProgress({
              id: `progress-${userId}-${progId}`,
              userId: `user-${userId.toString().padStart(3, '0')}`,
              achievementId: `achievement-${progId.toString().padStart(3, '0')}`,
              currentValue: Math.floor(progId / 2),
              targetValue: progId,
            }),
          );
        }
      }

      // Insert in batches
      const batchSize = 1000;
      const progressRepo = dataSource.getRepository(UserProgress);

      for (let i = 0; i < progressEntries.length; i += batchSize) {
        const batch = progressEntries.slice(i, i + batchSize);
        await progressRepo.save(batch);
      }

      // Test query performance
      const testUserIds = ['user-001', 'user-050', 'user-100'];

      for (const userId of testUserIds) {
        const startTime = Date.now();
        const response = await request(app.getHttpServer())
          .get(`/progress/user/${userId}`)
          .expect(200);
        const endTime = Date.now();

        expect(response.body).toHaveLength(progressEntriesPerUser);
        expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      }
    });

    it('should handle complex event data without memory leaks', async () => {
      const testUserId = '123e4567-e89b-12d3-a456-426614174000';
      const eventCount = 100;

      // Create achievement
      const achievement = TestDataFactory.createTestAchievement({
        id: 'achievement-001',
        name: 'Test Achievement',
        type: AchievementType.GAMES_PURCHASED,
        condition: { type: 'count', target: eventCount },
      });

      const achievementRepo = dataSource.getRepository(Achievement);
      await achievementRepo.save(achievement);

      // Send events with large, complex data
      for (let i = 1; i <= eventCount; i++) {
        const complexEventData = {
          gameId: `game-${i}`,
          title: `Game ${i}`,
          price: 1999 + i,
          metadata: {
            description: 'A'.repeat(1000), // Large string
            tags: Array(100).fill(`tag-${i}`), // Large array
            reviews: Array(50).fill({
              userId: `reviewer-${i}`,
              rating: 5,
              text: 'Great game! '.repeat(20), // Repeated text
            }),
            statistics: {
              playtime: i * 60,
              achievements: Array(20).fill({ id: i, unlocked: true }),
              scores: Array(100).fill(Math.random() * 1000),
            },
          },
        };

        await request(app.getHttpServer())
          .post('/progress/update')
          .send({
            userId: testUserId,
            eventType: 'game_purchase',
            eventData: complexEventData,
          })
          .expect(200);
      }

      // Verify final state
      const progress = await request(app.getHttpServer())
        .get(`/progress/user/${testUserId}`)
        .expect(200);

      const gameProgress = progress.body.find((p: any) => p.achievement.id === 'achievement-001');
      expect(gameProgress).toBeDefined();
      expect(gameProgress.currentValue).toBe(eventCount);
    });
  });
});
