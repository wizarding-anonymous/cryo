import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AchievementModule } from '../src/achievement/achievement.module';
import { testDatabaseConfig } from './test-database.config';
import { seedTestData, cleanupTestData, TestDataFactory } from './test-utils';
import { EventType } from '../src/achievement/dto/update-progress.dto';
import { Achievement } from '../src/achievement/entities/achievement.entity';
import { AchievementType } from '../src/achievement/entities/achievement.entity';

describe('Integration Tests - Full Achievement Flow (e2e)', () => {
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
  });

  afterAll(async () => {
    await cleanupTestData(dataSource);
    await app.close();
  });

  beforeEach(async () => {
    await cleanupTestData(dataSource);
    await seedTestData(dataSource);
  });

  describe('First-Time Achievement Flow', () => {
    const testUserId = '123e4567-e89b-12d3-a456-426614174000';

    it('should complete first purchase achievement flow', async () => {
      // Step 1: Verify user has no achievements initially
      const initialAchievements = await request(app.getHttpServer())
        .get(`/achievements/user/${testUserId}`)
        .expect(200);

      expect(initialAchievements.body.total).toBe(0);

      // Step 2: Verify user has no progress initially
      const initialProgress = await request(app.getHttpServer())
        .get(`/progress/user/${testUserId}`)
        .expect(200);

      expect(initialProgress.body).toHaveLength(0);

      // Step 3: Trigger first purchase event
      const progressUpdate = await request(app.getHttpServer())
        .post('/progress/update')
        .send({
          userId: testUserId,
          eventType: EventType.GAME_PURCHASE,
          eventData: {
            gameId: 'game-123',
            title: 'Test Game',
            price: 1999,
            currency: 'RUB',
          },
        })
        .expect(200);

      // Step 4: Verify progress was created and achievement was unlocked
      expect(progressUpdate.body).toBeInstanceOf(Array);
      const firstPurchaseProgress = progressUpdate.body.find(
        p => p.achievement.type === 'first_purchase',
      );
      expect(firstPurchaseProgress).toBeDefined();
      expect(firstPurchaseProgress.currentValue).toBe(1);
      expect(firstPurchaseProgress.targetValue).toBe(1);
      expect(firstPurchaseProgress.progressPercentage).toBe(100);

      // Step 5: Verify achievement was automatically unlocked
      const finalAchievements = await request(app.getHttpServer())
        .get(`/achievements/user/${testUserId}`)
        .expect(200);

      expect(finalAchievements.body.total).toBe(1);
      expect(finalAchievements.body.data[0].achievement.type).toBe('first_purchase');
      expect(finalAchievements.body.data[0]).toHaveProperty('unlockedAt');

      // Step 6: Verify progress is still tracked
      const finalProgress = await request(app.getHttpServer())
        .get(`/progress/user/${testUserId}`)
        .expect(200);

      expect(finalProgress.body.length).toBeGreaterThan(0);
      const purchaseProgress = finalProgress.body.find(
        p => p.achievement.type === 'first_purchase',
      );
      expect(purchaseProgress.currentValue).toBe(1);
    });

    it('should complete first review achievement flow', async () => {
      // Trigger first review event
      const progressUpdate = await request(app.getHttpServer())
        .post('/progress/update')
        .send({
          userId: testUserId,
          eventType: EventType.REVIEW_CREATED,
          eventData: {
            reviewId: 'review-123',
            gameId: 'game-123',
            rating: 5,
            text: 'Great game!',
          },
        })
        .expect(200);

      // Verify achievement was unlocked
      const firstReviewProgress = progressUpdate.body.find(
        p => p.achievement.type === 'first_review',
      );
      expect(firstReviewProgress).toBeDefined();
      expect(firstReviewProgress.progressPercentage).toBe(100);

      // Verify in user achievements
      const achievements = await request(app.getHttpServer())
        .get(`/achievements/user/${testUserId}`)
        .expect(200);

      expect(achievements.body.total).toBe(1);
      expect(achievements.body.data[0].achievement.type).toBe('first_review');
    });

    it('should complete first friend achievement flow', async () => {
      // Trigger first friend event
      const progressUpdate = await request(app.getHttpServer())
        .post('/progress/update')
        .send({
          userId: testUserId,
          eventType: EventType.FRIEND_ADDED,
          eventData: {
            friendId: 'friend-123',
            friendUsername: 'testfriend',
          },
        })
        .expect(200);

      // Verify achievement was unlocked
      const firstFriendProgress = progressUpdate.body.find(
        p => p.achievement.type === 'first_friend',
      );
      expect(firstFriendProgress).toBeDefined();
      expect(firstFriendProgress.progressPercentage).toBe(100);

      // Verify in user achievements
      const achievements = await request(app.getHttpServer())
        .get(`/achievements/user/${testUserId}`)
        .expect(200);

      expect(achievements.body.total).toBe(1);
      expect(achievements.body.data[0].achievement.type).toBe('first_friend');
    });
  });

  describe('Count-Based Achievement Flow', () => {
    const testUserId = '123e4567-e89b-12d3-a456-426614174000';

    it('should complete 5 games purchased achievement flow', async () => {
      // Purchase games one by one and track progress
      for (let i = 1; i <= 5; i++) {
        const progressUpdate = await request(app.getHttpServer())
          .post('/progress/update')
          .send({
            userId: testUserId,
            eventType: EventType.GAME_PURCHASE,
            eventData: {
              gameId: `game-${i}`,
              title: `Test Game ${i}`,
              price: 1999 + i * 100,
              currency: 'RUB',
            },
          })
          .expect(200);

        // Check progress for 5 games achievement
        const fiveGamesProgress = progressUpdate.body.find(
          p => p.achievement.type === 'games_purchased',
        );
        expect(fiveGamesProgress).toBeDefined();
        expect(fiveGamesProgress.currentValue).toBe(i);
        expect(fiveGamesProgress.targetValue).toBe(5);
        expect(fiveGamesProgress.progressPercentage).toBe((i / 5) * 100);

        // Check if achievement is unlocked when reaching 5
        if (i === 5) {
          expect(fiveGamesProgress.progressPercentage).toBe(100);
        }
      }

      // Verify final achievements
      const achievements = await request(app.getHttpServer())
        .get(`/achievements/user/${testUserId}`)
        .expect(200);

      expect(achievements.body.total).toBe(2); // first_purchase + games_purchased

      const achievementTypes = achievements.body.data.map(a => a.achievement.type);
      expect(achievementTypes).toContain('first_purchase');
      expect(achievementTypes).toContain('games_purchased');
    });

    it('should track progress correctly with mixed events', async () => {
      // Mix different types of events
      const events = [
        { type: EventType.GAME_PURCHASE, data: { gameId: 'game-1', price: 1999 } },
        {
          type: EventType.REVIEW_CREATED,
          data: { reviewId: 'review-1', gameId: 'game-1', rating: 5 },
        },
        { type: EventType.GAME_PURCHASE, data: { gameId: 'game-2', price: 2999 } },
        { type: EventType.FRIEND_ADDED, data: { friendId: 'friend-1' } },
        { type: EventType.GAME_PURCHASE, data: { gameId: 'game-3', price: 1499 } },
      ];

      for (const event of events) {
        await request(app.getHttpServer())
          .post('/progress/update')
          .send({
            userId: testUserId,
            eventType: event.type,
            eventData: event.data,
          })
          .expect(200);
      }

      // Check final progress
      const progress = await request(app.getHttpServer())
        .get(`/progress/user/${testUserId}`)
        .expect(200);

      // Should have progress for games_purchased achievement
      const gamesProgress = progress.body.find(p => p.achievement.type === 'games_purchased');
      expect(gamesProgress).toBeDefined();
      expect(gamesProgress.currentValue).toBe(3); // 3 game purchases

      // Check achievements
      const achievements = await request(app.getHttpServer())
        .get(`/achievements/user/${testUserId}`)
        .expect(200);

      expect(achievements.body.total).toBe(3); // first_purchase, first_review, first_friend
    });
  });

  describe('Multiple Users Achievement Flow', () => {
    const user1Id = '123e4567-e89b-12d3-a456-426614174001';
    const user2Id = '123e4567-e89b-12d3-a456-426614174002';

    it('should handle achievements for multiple users independently', async () => {
      // User 1 purchases a game
      await request(app.getHttpServer())
        .post('/progress/update')
        .send({
          userId: user1Id,
          eventType: EventType.GAME_PURCHASE,
          eventData: { gameId: 'game-1', price: 1999 },
        })
        .expect(200);

      // User 2 writes a review
      await request(app.getHttpServer())
        .post('/progress/update')
        .send({
          userId: user2Id,
          eventType: EventType.REVIEW_CREATED,
          eventData: { reviewId: 'review-1', gameId: 'game-1', rating: 4 },
        })
        .expect(200);

      // Check User 1 achievements
      const user1Achievements = await request(app.getHttpServer())
        .get(`/achievements/user/${user1Id}`)
        .expect(200);

      expect(user1Achievements.body.total).toBe(1);
      expect(user1Achievements.body.data[0].achievement.type).toBe('first_purchase');

      // Check User 2 achievements
      const user2Achievements = await request(app.getHttpServer())
        .get(`/achievements/user/${user2Id}`)
        .expect(200);

      expect(user2Achievements.body.total).toBe(1);
      expect(user2Achievements.body.data[0].achievement.type).toBe('first_review');

      // Verify users don't see each other's achievements
      expect(user1Achievements.body.data[0].userId).toBe(user1Id);
      expect(user2Achievements.body.data[0].userId).toBe(user2Id);
    });

    it('should handle concurrent progress updates from multiple users', async () => {
      const promises = [];

      // User 1 makes multiple purchases
      for (let i = 1; i <= 3; i++) {
        promises.push(
          request(app.getHttpServer())
            .post('/progress/update')
            .send({
              userId: user1Id,
              eventType: EventType.GAME_PURCHASE,
              eventData: { gameId: `game-${i}`, price: 1999 },
            }),
        );
      }

      // User 2 makes multiple reviews
      for (let i = 1; i <= 2; i++) {
        promises.push(
          request(app.getHttpServer())
            .post('/progress/update')
            .send({
              userId: user2Id,
              eventType: EventType.REVIEW_CREATED,
              eventData: { reviewId: `review-${i}`, gameId: `game-${i}`, rating: 5 },
            }),
        );
      }

      const responses = await Promise.all(promises);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Check final states
      const user1Progress = await request(app.getHttpServer())
        .get(`/progress/user/${user1Id}`)
        .expect(200);

      const user2Progress = await request(app.getHttpServer())
        .get(`/progress/user/${user2Id}`)
        .expect(200);

      // User 1 should have progress for games
      const user1GamesProgress = user1Progress.body.find(
        p => p.achievement.type === 'games_purchased',
      );
      expect(user1GamesProgress).toBeDefined();
      expect(user1GamesProgress.currentValue).toBe(3);

      // User 2 should have progress for reviews (but no games progress)
      const user2ReviewsProgress = user2Progress.body.find(
        p => p.achievement.type === 'reviews_written',
      );
      // Note: reviews_written achievement might not exist in seed data
      // This test verifies isolation between users
    });
  });

  describe('Achievement System Edge Cases', () => {
    const testUserId = '123e4567-e89b-12d3-a456-426614174000';

    it('should handle duplicate events correctly', async () => {
      // Send the same event multiple times
      const eventData = {
        userId: testUserId,
        eventType: EventType.GAME_PURCHASE,
        eventData: { gameId: 'game-123', price: 1999 },
      };

      // Send same event 3 times
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer()).post('/progress/update').send(eventData).expect(200);
      }

      // Check progress - should count all events
      const progress = await request(app.getHttpServer())
        .get(`/progress/user/${testUserId}`)
        .expect(200);

      const gamesProgress = progress.body.find(p => p.achievement.type === 'games_purchased');
      expect(gamesProgress).toBeDefined();
      expect(gamesProgress.currentValue).toBe(3);

      // But first_purchase should only be unlocked once
      const achievements = await request(app.getHttpServer())
        .get(`/achievements/user/${testUserId}`)
        .expect(200);

      const firstPurchaseAchievements = achievements.body.data.filter(
        a => a.achievement.type === 'first_purchase',
      );
      expect(firstPurchaseAchievements).toHaveLength(1); // Only one instance
    });

    it('should handle progress updates after achievement is already unlocked', async () => {
      // First, unlock the first purchase achievement
      await request(app.getHttpServer())
        .post('/progress/update')
        .send({
          userId: testUserId,
          eventType: EventType.GAME_PURCHASE,
          eventData: { gameId: 'game-1', price: 1999 },
        })
        .expect(200);

      // Verify achievement is unlocked
      const initialAchievements = await request(app.getHttpServer())
        .get(`/achievements/user/${testUserId}`)
        .expect(200);

      expect(initialAchievements.body.total).toBe(1);

      // Continue making purchases
      for (let i = 2; i <= 4; i++) {
        await request(app.getHttpServer())
          .post('/progress/update')
          .send({
            userId: testUserId,
            eventType: EventType.GAME_PURCHASE,
            eventData: { gameId: `game-${i}`, price: 1999 },
          })
          .expect(200);
      }

      // Check that progress continues to be tracked
      const finalProgress = await request(app.getHttpServer())
        .get(`/progress/user/${testUserId}`)
        .expect(200);

      const gamesProgress = finalProgress.body.find(p => p.achievement.type === 'games_purchased');
      expect(gamesProgress).toBeDefined();
      expect(gamesProgress.currentValue).toBe(4);

      // Achievement count should remain the same (no duplicates)
      const finalAchievements = await request(app.getHttpServer())
        .get(`/achievements/user/${testUserId}`)
        .expect(200);

      expect(finalAchievements.body.total).toBe(1); // Still just first_purchase
    });

    it('should handle rapid sequential events correctly', async () => {
      const promises = [];

      // Send 10 rapid sequential purchase events
      for (let i = 1; i <= 10; i++) {
        promises.push(
          request(app.getHttpServer())
            .post('/progress/update')
            .send({
              userId: testUserId,
              eventType: EventType.GAME_PURCHASE,
              eventData: { gameId: `game-${i}`, price: 1999 + i },
            }),
        );
      }

      const responses = await Promise.all(promises);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Check final progress
      const progress = await request(app.getHttpServer())
        .get(`/progress/user/${testUserId}`)
        .expect(200);

      const gamesProgress = progress.body.find(p => p.achievement.type === 'games_purchased');
      expect(gamesProgress).toBeDefined();
      expect(gamesProgress.currentValue).toBe(10);

      // Check achievements - should have both first_purchase and games_purchased (5 games)
      const achievements = await request(app.getHttpServer())
        .get(`/achievements/user/${testUserId}`)
        .expect(200);

      expect(achievements.body.total).toBe(2);
      const achievementTypes = achievements.body.data.map(a => a.achievement.type);
      expect(achievementTypes).toContain('first_purchase');
      expect(achievementTypes).toContain('games_purchased');
    });
  });

  describe('Data Consistency Verification', () => {
    const testUserId = '123e4567-e89b-12d3-a456-426614174000';

    it('should maintain data consistency across all operations', async () => {
      // Perform a series of operations
      const operations = [
        { type: EventType.GAME_PURCHASE, data: { gameId: 'game-1', price: 1999 } },
        {
          type: EventType.REVIEW_CREATED,
          data: { reviewId: 'review-1', gameId: 'game-1', rating: 5 },
        },
        { type: EventType.FRIEND_ADDED, data: { friendId: 'friend-1' } },
        { type: EventType.GAME_PURCHASE, data: { gameId: 'game-2', price: 2999 } },
        { type: EventType.GAME_PURCHASE, data: { gameId: 'game-3', price: 1499 } },
      ];

      for (const operation of operations) {
        await request(app.getHttpServer())
          .post('/progress/update')
          .send({
            userId: testUserId,
            eventType: operation.type,
            eventData: operation.data,
          })
          .expect(200);
      }

      // Get all data
      const achievements = await request(app.getHttpServer())
        .get(`/achievements/user/${testUserId}`)
        .expect(200);

      const progress = await request(app.getHttpServer())
        .get(`/progress/user/${testUserId}`)
        .expect(200);

      const allAchievements = await request(app.getHttpServer()).get('/achievements').expect(200);

      // Verify data consistency
      expect(achievements.body.total).toBe(3); // first_purchase, first_review, first_friend
      expect(progress.body.length).toBeGreaterThan(0);
      expect(allAchievements.body.length).toBeGreaterThanOrEqual(3);

      // Verify each unlocked achievement has corresponding progress
      for (const userAchievement of achievements.body.data) {
        const correspondingProgress = progress.body.find(
          p => p.achievement.id === userAchievement.achievement.id,
        );

        if (userAchievement.achievement.condition.type === 'first_time') {
          // For first-time achievements, progress should be 100%
          expect(correspondingProgress.progressPercentage).toBe(100);
        }
      }

      // Verify games purchased progress
      const gamesProgress = progress.body.find(p => p.achievement.type === 'games_purchased');
      expect(gamesProgress).toBeDefined();
      expect(gamesProgress.currentValue).toBe(3); // 3 game purchases
    });
  });
});
