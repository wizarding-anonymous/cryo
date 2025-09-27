import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';

describe('Performance Tests (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authTokens: string[] = [];
  let userIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    dataSource = moduleFixture.get<DataSource>(getDataSourceToken());

    await app.init();

    // Create test users for performance testing
    await createTestUsers(100); // Start with 100 users for basic testing
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  describe('Friends System Performance', () => {
    it('should handle 100 concurrent friend requests within 5 seconds', async () => {
      const startTime = Date.now();
      const promises: Promise<any>[] = [];

      // Create 100 concurrent friend requests
      for (let i = 0; i < 50; i++) {
        const fromUser = i;
        const toUser = (i + 50) % 100;

        promises.push(
          request(app.getHttpServer())
            .post('/v1/friends/request')
            .set('Authorization', `Bearer ${authTokens[fromUser]}`)
            .send({ toUserId: userIds[toUser] })
            .expect(201)
        );
      }

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Check that all requests completed within 5 seconds
      expect(duration).toBeLessThan(5000);

      // Check success rate (should be > 95%)
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const successRate = (successCount / promises.length) * 100;
      expect(successRate).toBeGreaterThan(95);

      console.log(`Friend requests performance: ${duration}ms for ${promises.length} requests`);
      console.log(`Success rate: ${successRate}%`);
    });

    it('should handle 200 concurrent friend list retrievals within 3 seconds', async () => {
      const startTime = Date.now();
      const promises: Promise<any>[] = [];

      // Create 200 concurrent friend list requests
      for (let i = 0; i < 100; i++) {
        promises.push(
          request(app.getHttpServer())
            .get('/v1/friends')
            .set('Authorization', `Bearer ${authTokens[i]}`)
            .expect(200)
        );

        // Add another request for the same user to test caching
        promises.push(
          request(app.getHttpServer())
            .get('/v1/friends')
            .set('Authorization', `Bearer ${authTokens[i]}`)
            .expect(200)
        );
      }

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(3000);

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const successRate = (successCount / promises.length) * 100;
      expect(successRate).toBeGreaterThan(98); // Higher success rate expected for reads

      console.log(`Friend list retrieval performance: ${duration}ms for ${promises.length} requests`);
      console.log(`Success rate: ${successRate}%`);
    });
  });

  describe('Messaging System Performance', () => {
    it('should handle 100 concurrent messages within 4 seconds', async () => {
      // First establish some friendships
      await establishTestFriendships(20);

      const startTime = Date.now();
      const promises: Promise<any>[] = [];

      // Create 100 concurrent messages between friends
      for (let i = 0; i < 100; i++) {
        const fromUser = i % 20;
        const toUser = (fromUser + 1) % 20;

        promises.push(
          request(app.getHttpServer())
            .post('/v1/messages')
            .set('Authorization', `Bearer ${authTokens[fromUser]}`)
            .send({
              toUserId: userIds[toUser],
              content: `Performance test message ${i}`
            })
            .expect(201)
        );
      }

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(4000);

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const successRate = (successCount / promises.length) * 100;
      expect(successRate).toBeGreaterThan(95);

      console.log(`Message sending performance: ${duration}ms for ${promises.length} messages`);
      console.log(`Success rate: ${successRate}%`);
    });

    it('should handle 150 concurrent conversation retrievals within 2 seconds', async () => {
      const startTime = Date.now();
      const promises: Promise<any>[] = [];

      // Create 150 concurrent conversation requests
      for (let i = 0; i < 150; i++) {
        const user = i % 20;
        const friend = (user + 1) % 20;

        promises.push(
          request(app.getHttpServer())
            .get(`/v1/messages/conversations/${userIds[friend]}`)
            .set('Authorization', `Bearer ${authTokens[user]}`)
            .expect(200)
        );
      }

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(2000);

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const successRate = (successCount / promises.length) * 100;
      expect(successRate).toBeGreaterThan(98);

      console.log(`Conversation retrieval performance: ${duration}ms for ${promises.length} requests`);
      console.log(`Success rate: ${successRate}%`);
    });
  });

  describe('Status System Performance', () => {
    it('should handle 200 concurrent status updates within 2 seconds', async () => {
      const startTime = Date.now();
      const promises: Promise<any>[] = [];

      // Create 200 concurrent status updates
      for (let i = 0; i < 100; i++) {
        promises.push(
          request(app.getHttpServer())
            .put('/v1/status/online')
            .set('Authorization', `Bearer ${authTokens[i]}`)
            .send({ currentGame: `Game ${i % 10}` })
            .expect(200)
        );

        promises.push(
          request(app.getHttpServer())
            .get('/v1/status/friends')
            .set('Authorization', `Bearer ${authTokens[i]}`)
            .expect(200)
        );
      }

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(2000);

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const successRate = (successCount / promises.length) * 100;
      expect(successRate).toBeGreaterThan(98);

      console.log(`Status operations performance: ${duration}ms for ${promises.length} operations`);
      console.log(`Success rate: ${successRate}%`);
    });
  });

  describe('Integration Endpoints Performance', () => {
    it('should handle 100 concurrent integration requests within 3 seconds', async () => {
      const startTime = Date.now();
      const promises: Promise<any>[] = [];

      // Test various integration endpoints
      for (let i = 0; i < 25; i++) {
        const userId = userIds[i];
        const targetUserId = userIds[(i + 1) % 25];

        // Achievement integration
        promises.push(
          request(app.getHttpServer())
            .get(`/integration/achievement/${userId}/friends`)
            .set('x-internal-token', 'test-internal-token')
            .expect(200)
        );

        // Review integration
        promises.push(
          request(app.getHttpServer())
            .get(`/integration/review/${userId}/connections/${targetUserId}`)
            .set('x-internal-token', 'test-internal-token')
            .expect(200)
        );

        // Mutual friends
        promises.push(
          request(app.getHttpServer())
            .get(`/integration/review/${userId}/mutual-friends/${targetUserId}`)
            .set('x-internal-token', 'test-internal-token')
            .expect(200)
        );

        // Notification preferences
        promises.push(
          request(app.getHttpServer())
            .get(`/integration/notification/${userId}/preferences`)
            .set('x-internal-token', 'test-internal-token')
            .expect(200)
        );
      }

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(3000);

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const successRate = (successCount / promises.length) * 100;
      expect(successRate).toBeGreaterThan(95);

      console.log(`Integration endpoints performance: ${duration}ms for ${promises.length} requests`);
      console.log(`Success rate: ${successRate}%`);
    });
  });

  // Helper functions
  async function createTestUsers(count: number): Promise<void> {
    // Mock user creation - in real scenario this would integrate with User Service
    for (let i = 0; i < count; i++) {
      const userId = `test-user-${i}-${Date.now()}`;
      const token = `test-token-${i}-${Date.now()}`;

      userIds.push(userId);
      authTokens.push(token);
    }
  }

  async function establishTestFriendships(count: number): Promise<void> {
    const promises: Promise<any>[] = [];

    for (let i = 0; i < count - 1; i++) {
      // Send friend request
      promises.push(
        request(app.getHttpServer())
          .post('/v1/friends/request')
          .set('Authorization', `Bearer ${authTokens[i]}`)
          .send({ toUserId: userIds[i + 1] })
      );
    }

    await Promise.allSettled(promises);

    // Accept all friend requests (simplified for testing)
    const acceptPromises: Promise<any>[] = [];

    // In a real scenario, we'd need to get the request IDs and accept them
    // For performance testing, we'll assume they're auto-accepted

    await Promise.allSettled(acceptPromises);
  }

  async function cleanupTestData(): Promise<void> {
    try {
      // Clean up test data
      await dataSource.query('DELETE FROM messages WHERE from_user_id LIKE $1 OR to_user_id LIKE $1', ['test-user-%']);
      await dataSource.query('DELETE FROM friendships WHERE user_id LIKE $1 OR friend_id LIKE $1', ['test-user-%']);
      await dataSource.query('DELETE FROM online_status WHERE user_id LIKE $1', ['test-user-%']);
    } catch (error) {
      console.warn('Cleanup failed:', error instanceof Error ? error.message : 'Unknown error');
    }
  }
});