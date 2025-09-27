import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AchievementModule } from '../src/achievement/achievement.module';
import { testDatabaseConfig } from './test-database.config';
import { TestDatabaseSetup } from './test-database-setup';
import { seedTestData, cleanupTestData } from './test-utils';
import { EventType } from '../src/achievement/dto/update-progress.dto';
import { Achievement } from '../src/achievement/entities/achievement.entity';
import { UserAchievement } from '../src/achievement/entities/user-achievement.entity';
import { UserProgress } from '../src/achievement/entities/user-progress.entity';
import { UserProgressResponseDto } from '../src/achievement/dto/user-progress-response.dto';
import { UserAchievementResponseDto } from '../src/achievement/dto/user-achievement-response.dto';

describe('Full Flow Integration Tests (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    // Wait for database to be ready
    await TestDatabaseSetup.waitForDatabase();

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
  });

  afterAll(async () => {
    await cleanupTestData(dataSource);
    await app.close();
    await TestDatabaseSetup.closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTestData(dataSource);
    await seedTestData(dataSource);
  });

  describe('Complete Achievement Flow: Event → Progress Update → Achievement Unlock', () => {
    const testUserId = '123e4567-e89b-12d3-a456-426614174000';

    it('should complete full first purchase flow with notification', async () => {
      // Step 1: Verify initial state - no achievements or progress
      const initialAchievements = await request(app.getHttpServer())
        .get(`/achievements/user/${testUserId}`)
        .expect(200);
      expect(initialAchievements.body.total).toBe(0);

      const initialProgress = await request(app.getHttpServer())
        .get(`/progress/user/${testUserId}`)
        .expect(200);
      expect(initialProgress.body).toHaveLength(0);

      // Step 2: Trigger game purchase event
      const purchaseEventData = {
        userId: testUserId,
        eventType: EventType.GAME_PURCHASE,
        eventData: {
          gameId: 'game-123',
          title: 'Test Game',
          price: 1999,
          currency: 'RUB',
          purchaseDate: new Date().toISOString(),
          platform: 'PC',
        },
      };

      const progressResponse = await request(app.getHttpServer())
        .post('/progress/update')
        .send(purchaseEventData)
        .expect(200);

      // Step 3: Verify progress was created and updated
      expect(progressResponse.body).toBeInstanceOf(Array);
      expect(progressResponse.body.length).toBeGreaterThan(0);

      const firstPurchaseProgress = progressResponse.body.find(
        (p: UserProgressResponseDto) => p.achievement.type === 'first_purchase',
      );
      expect(firstPurchaseProgress).toBeDefined();
      expect(firstPurchaseProgress.currentValue).toBe(1);
      expect(firstPurchaseProgress.targetValue).toBe(1);
      expect(firstPurchaseProgress.progressPercentage).toBe(100);

      // Step 4: Verify achievement was automatically unlocked
      const unlockedAchievements = await request(app.getHttpServer())
        .get(`/achievements/user/${testUserId}`)
        .expect(200);

      expect(unlockedAchievements.body.total).toBe(1);
      expect(unlockedAchievements.body.data[0].achievement.type).toBe('first_purchase');
      expect(unlockedAchievements.body.data[0]).toHaveProperty('unlockedAt');
      expect(new Date(unlockedAchievements.body.data[0].unlockedAt)).toBeInstanceOf(Date);

      // Step 5: Verify progress is still tracked after achievement unlock
      const finalProgress = await request(app.getHttpServer())
        .get(`/progress/user/${testUserId}`)
        .expect(200);

      expect(finalProgress.body.length).toBeGreaterThan(0);
      const purchaseProgress = finalProgress.body.find(
        (p: UserProgressResponseDto) => p.achievement.type === 'first_purchase',
      );
      expect(purchaseProgress).toBeDefined();
      expect(purchaseProgress.currentValue).toBe(1);
      expect(purchaseProgress.progressPercentage).toBe(100);

      // Step 6: Verify database consistency
      const achievementRepo = dataSource.getRepository(Achievement);
      const userAchievementRepo = dataSource.getRepository(UserAchievement);
      const progressRepo = dataSource.getRepository(UserProgress);

      const dbAchievements = await achievementRepo.find();
      const dbUserAchievements = await userAchievementRepo.find({
        where: { userId: testUserId },
        relations: ['achievement'],
      });
      const dbProgress = await progressRepo.find({
        where: { userId: testUserId },
        relations: ['achievement'],
      });

      expect(dbAchievements.length).toBeGreaterThanOrEqual(3); // Seed data
      expect(dbUserAchievements).toHaveLength(1);
      expect(dbProgress.length).toBeGreaterThan(0);
    });

    it('should complete full review creation flow', async () => {
      // Trigger review creation event
      const reviewEventData = {
        userId: testUserId,
        eventType: EventType.REVIEW_CREATED,
        eventData: {
          reviewId: 'review-123',
          gameId: 'game-123',
          rating: 5,
          text: 'Отличная игра! Рекомендую всем.',
          createdAt: new Date().toISOString(),
          isRecommended: true,
        },
      };

      const progressResponse = await request(app.getHttpServer())
        .post('/progress/update')
        .send(reviewEventData)
        .expect(200);

      // Verify progress and achievement unlock
      const firstReviewProgress = progressResponse.body.find(
        (p: UserProgressResponseDto) => p.achievement.type === 'first_review',
      );
      expect(firstReviewProgress).toBeDefined();
      expect(firstReviewProgress.progressPercentage).toBe(100);

      // Verify achievement in user's list
      const achievements = await request(app.getHttpServer())
        .get(`/achievements/user/${testUserId}`)
        .expect(200);

      expect(achievements.body.total).toBe(1);
      expect(achievements.body.data[0].achievement.type).toBe('first_review');
    });

    it('should complete full friend addition flow', async () => {
      // Trigger friend addition event
      const friendEventData = {
        userId: testUserId,
        eventType: EventType.FRIEND_ADDED,
        eventData: {
          friendId: 'friend-123',
          friendUsername: 'testfriend',
          addedAt: new Date().toISOString(),
          mutualFriends: 0,
        },
      };

      const progressResponse = await request(app.getHttpServer())
        .post('/progress/update')
        .send(friendEventData)
        .expect(200);

      // Verify progress and achievement unlock
      const firstFriendProgress = progressResponse.body.find(
        (p: UserProgressResponseDto) => p.achievement.type === 'first_friend',
      );
      expect(firstFriendProgress).toBeDefined();
      expect(firstFriendProgress.progressPercentage).toBe(100);

      // Verify achievement in user's list
      const achievements = await request(app.getHttpServer())
        .get(`/achievements/user/${testUserId}`)
        .expect(200);

      expect(achievements.body.total).toBe(1);
      expect(achievements.body.data[0].achievement.type).toBe('first_friend');
    });

    it('should handle complex multi-event flow with count-based achievements', async () => {
      const events = [
        // First purchase - should unlock first_purchase achievement
        {
          type: EventType.GAME_PURCHASE,
          data: { gameId: 'game-1', title: 'Game 1', price: 1999 },
        },
        // First review - should unlock first_review achievement
        {
          type: EventType.REVIEW_CREATED,
          data: { reviewId: 'review-1', gameId: 'game-1', rating: 5 },
        },
        // First friend - should unlock first_friend achievement
        {
          type: EventType.FRIEND_ADDED,
          data: { friendId: 'friend-1', friendUsername: 'friend1' },
        },
        // More purchases - should progress toward games_purchased achievement
        {
          type: EventType.GAME_PURCHASE,
          data: { gameId: 'game-2', title: 'Game 2', price: 2999 },
        },
        {
          type: EventType.GAME_PURCHASE,
          data: { gameId: 'game-3', title: 'Game 3', price: 1499 },
        },
        {
          type: EventType.GAME_PURCHASE,
          data: { gameId: 'game-4', title: 'Game 4', price: 3999 },
        },
        {
          type: EventType.GAME_PURCHASE,
          data: { gameId: 'game-5', title: 'Game 5', price: 999 },
        },
      ];

      // Process events sequentially
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const response = await request(app.getHttpServer())
          .post('/progress/update')
          .send({
            userId: testUserId,
            eventType: event.type,
            eventData: event.data,
          })
          .expect(200);

        // Verify progress after each event
        expect(response.body).toBeInstanceOf(Array);

        // Check specific progress based on event type
        if (event.type === EventType.GAME_PURCHASE) {
          const gamesProgress = response.body.find(
            (p: UserProgressResponseDto) => p.achievement.type === 'games_purchased',
          );
          expect(gamesProgress).toBeDefined();

          // Count how many purchase events we've processed so far
          const purchaseCount = events
            .slice(0, i + 1)
            .filter(e => e.type === EventType.GAME_PURCHASE).length;
          expect(gamesProgress.currentValue).toBe(purchaseCount);
        }
      }

      // Verify final state
      const finalAchievements = await request(app.getHttpServer())
        .get(`/achievements/user/${testUserId}`)
        .expect(200);

      // Should have 4 achievements: first_purchase, first_review, first_friend, games_purchased (5 games)
      expect(finalAchievements.body.total).toBe(4);

      const achievementTypes = finalAchievements.body.data.map(
        (a: UserAchievementResponseDto) => a.achievement.type,
      );
      expect(achievementTypes).toContain('first_purchase');
      expect(achievementTypes).toContain('first_review');
      expect(achievementTypes).toContain('first_friend');
      expect(achievementTypes).toContain('games_purchased');

      // Verify final progress
      const finalProgress = await request(app.getHttpServer())
        .get(`/progress/user/${testUserId}`)
        .expect(200);

      const gamesProgress = finalProgress.body.find(
        (p: UserProgressResponseDto) => p.achievement.type === 'games_purchased',
      );
      expect(gamesProgress).toBeDefined();
      expect(gamesProgress.currentValue).toBe(5);
      expect(gamesProgress.progressPercentage).toBe(100);
    });

    it('should handle concurrent events correctly', async () => {
      const concurrentEvents = [
        {
          userId: testUserId,
          eventType: EventType.GAME_PURCHASE,
          eventData: { gameId: 'game-1', price: 1999 },
        },
        {
          userId: testUserId,
          eventType: EventType.GAME_PURCHASE,
          eventData: { gameId: 'game-2', price: 2999 },
        },
        {
          userId: testUserId,
          eventType: EventType.REVIEW_CREATED,
          eventData: { reviewId: 'review-1', gameId: 'game-1', rating: 5 },
        },
        {
          userId: testUserId,
          eventType: EventType.FRIEND_ADDED,
          eventData: { friendId: 'friend-1' },
        },
        {
          userId: testUserId,
          eventType: EventType.GAME_PURCHASE,
          eventData: { gameId: 'game-3', price: 1499 },
        },
      ];

      // Send all events concurrently
      const promises = concurrentEvents.map(event =>
        request(app.getHttpServer()).post('/progress/update').send(event),
      );

      const responses = await Promise.all(promises);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
      });

      // Verify final state is consistent
      const achievements = await request(app.getHttpServer())
        .get(`/achievements/user/${testUserId}`)
        .expect(200);

      expect(achievements.body.total).toBe(3); // first_purchase, first_review, first_friend

      const progress = await request(app.getHttpServer())
        .get(`/progress/user/${testUserId}`)
        .expect(200);

      const gamesProgress = progress.body.find(
        (p: UserProgressResponseDto) => p.achievement.type === 'games_purchased',
      );
      expect(gamesProgress).toBeDefined();
      expect(gamesProgress.currentValue).toBe(3); // 3 game purchases
    });

    it('should maintain data integrity across multiple users', async () => {
      const user1Id = '123e4567-e89b-12d3-a456-426614174001';
      const user2Id = '123e4567-e89b-12d3-a456-426614174002';

      // User 1 events
      await request(app.getHttpServer())
        .post('/progress/update')
        .send({
          userId: user1Id,
          eventType: EventType.GAME_PURCHASE,
          eventData: { gameId: 'game-1', price: 1999 },
        })
        .expect(200);

      await request(app.getHttpServer())
        .post('/progress/update')
        .send({
          userId: user1Id,
          eventType: EventType.REVIEW_CREATED,
          eventData: { reviewId: 'review-1', gameId: 'game-1', rating: 5 },
        })
        .expect(200);

      // User 2 events
      await request(app.getHttpServer())
        .post('/progress/update')
        .send({
          userId: user2Id,
          eventType: EventType.FRIEND_ADDED,
          eventData: { friendId: 'friend-1' },
        })
        .expect(200);

      await request(app.getHttpServer())
        .post('/progress/update')
        .send({
          userId: user2Id,
          eventType: EventType.GAME_PURCHASE,
          eventData: { gameId: 'game-2', price: 2999 },
        })
        .expect(200);

      // Verify User 1 achievements
      const user1Achievements = await request(app.getHttpServer())
        .get(`/achievements/user/${user1Id}`)
        .expect(200);

      expect(user1Achievements.body.total).toBe(2); // first_purchase, first_review
      const user1Types = user1Achievements.body.data.map(
        (a: UserAchievementResponseDto) => a.achievement.type,
      );
      expect(user1Types).toContain('first_purchase');
      expect(user1Types).toContain('first_review');

      // Verify User 2 achievements
      const user2Achievements = await request(app.getHttpServer())
        .get(`/achievements/user/${user2Id}`)
        .expect(200);

      expect(user2Achievements.body.total).toBe(2); // first_friend, first_purchase
      const user2Types = user2Achievements.body.data.map(
        (a: UserAchievementResponseDto) => a.achievement.type,
      );
      expect(user2Types).toContain('first_friend');
      expect(user2Types).toContain('first_purchase');

      // Verify users don't see each other's achievements
      user1Achievements.body.data.forEach((achievement: UserAchievementResponseDto) => {
        expect(achievement.userId).toBe(user1Id);
      });

      user2Achievements.body.data.forEach((achievement: UserAchievementResponseDto) => {
        expect(achievement.userId).toBe(user2Id);
      });
    });

    it('should handle edge case: duplicate achievement unlock attempts', async () => {
      // First, trigger an event that unlocks an achievement
      await request(app.getHttpServer())
        .post('/progress/update')
        .send({
          userId: testUserId,
          eventType: EventType.GAME_PURCHASE,
          eventData: { gameId: 'game-1', price: 1999 },
        })
        .expect(200);

      // Verify achievement is unlocked
      const achievements = await request(app.getHttpServer())
        .get(`/achievements/user/${testUserId}`)
        .expect(200);

      expect(achievements.body.total).toBe(1);
      const firstPurchaseAchievement = achievements.body.data.find(
        (a: UserAchievementResponseDto) => a.achievement.type === 'first_purchase',
      );
      expect(firstPurchaseAchievement).toBeDefined();

      // Try to manually unlock the same achievement
      const unlockResponse = await request(app.getHttpServer())
        .post('/achievements/unlock')
        .send({
          userId: testUserId,
          achievementId: firstPurchaseAchievement.achievement.id,
        })
        .expect(409); // Should return conflict

      expect(unlockResponse.body.message).toContain('already unlocked');

      // Verify still only one achievement
      const finalAchievements = await request(app.getHttpServer())
        .get(`/achievements/user/${testUserId}`)
        .expect(200);

      expect(finalAchievements.body.total).toBe(1);
    });

    it('should handle progress updates after achievement is already unlocked', async () => {
      // Unlock first purchase achievement
      await request(app.getHttpServer())
        .post('/progress/update')
        .send({
          userId: testUserId,
          eventType: EventType.GAME_PURCHASE,
          eventData: { gameId: 'game-1', price: 1999 },
        })
        .expect(200);

      // Continue making purchases (should still track progress for count-based achievements)
      for (let i = 2; i <= 3; i++) {
        await request(app.getHttpServer())
          .post('/progress/update')
          .send({
            userId: testUserId,
            eventType: EventType.GAME_PURCHASE,
            eventData: { gameId: `game-${i}`, price: 1999 },
          })
          .expect(200);
      }

      // Verify progress continues to be tracked
      const progress = await request(app.getHttpServer())
        .get(`/progress/user/${testUserId}`)
        .expect(200);

      const gamesProgress = progress.body.find(
        (p: UserProgressResponseDto) => p.achievement.type === 'games_purchased',
      );
      expect(gamesProgress).toBeDefined();
      expect(gamesProgress.currentValue).toBe(3);

      // Verify no duplicate achievements
      const achievements = await request(app.getHttpServer())
        .get(`/achievements/user/${testUserId}`)
        .expect(200);

      const firstPurchaseAchievements = achievements.body.data.filter(
        (a: UserAchievementResponseDto) => a.achievement.type === 'first_purchase',
      );
      expect(firstPurchaseAchievements).toHaveLength(1); // Only one instance
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle rapid sequential events efficiently', async () => {
      const testUserId = '123e4567-e89b-12d3-a456-426614174000';
      const eventCount = 20;

      const startTime = Date.now();

      // Send rapid sequential events
      for (let i = 1; i <= eventCount; i++) {
        await request(app.getHttpServer())
          .post('/progress/update')
          .send({
            userId: testUserId,
            eventType: EventType.GAME_PURCHASE,
            eventData: { gameId: `game-${i}`, price: 1999 + i },
          })
          .expect(200);
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete within reasonable time (adjust based on your performance requirements)
      expect(totalTime).toBeLessThan(10000); // 10 seconds for 20 events

      // Verify final state
      const progress = await request(app.getHttpServer())
        .get(`/progress/user/${testUserId}`)
        .expect(200);

      const gamesProgress = progress.body.find(
        (p: UserProgressResponseDto) => p.achievement.type === 'games_purchased',
      );
      expect(gamesProgress).toBeDefined();
      expect(gamesProgress.currentValue).toBe(eventCount);

      // Should have unlocked both first_purchase and games_purchased (if eventCount >= 5)
      const achievements = await request(app.getHttpServer())
        .get(`/achievements/user/${testUserId}`)
        .expect(200);

      expect(achievements.body.total).toBeGreaterThanOrEqual(1);
      if (eventCount >= 5) {
        expect(achievements.body.total).toBe(2); // first_purchase + games_purchased
      }
    });

    it('should handle multiple concurrent users efficiently', async () => {
      const userCount = 10;
      const eventsPerUser = 3;
      const promises = [];

      const startTime = Date.now();

      // Create concurrent events for multiple users
      for (let userId = 1; userId <= userCount; userId++) {
        for (let eventId = 1; eventId <= eventsPerUser; eventId++) {
          promises.push(
            request(app.getHttpServer())
              .post('/progress/update')
              .send({
                userId: `user-${userId.toString().padStart(3, '0')}`,
                eventType: EventType.GAME_PURCHASE,
                eventData: { gameId: `game-${eventId}`, price: 1999 },
              }),
          );
        }
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(15000); // 15 seconds for 30 concurrent requests

      // Verify each user has correct achievements
      for (let userId = 1; userId <= userCount; userId++) {
        const userIdStr = `user-${userId.toString().padStart(3, '0')}`;
        const achievements = await request(app.getHttpServer())
          .get(`/achievements/user/${userIdStr}`)
          .expect(200);

        expect(achievements.body.total).toBe(1); // first_purchase
      }
    });
  });
});
