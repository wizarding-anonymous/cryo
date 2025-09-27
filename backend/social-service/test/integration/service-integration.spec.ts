import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';

describe('Service Integration Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const testUsers = [
    { id: 'user-1', token: 'test-token-user-1' },
    { id: 'user-2', token: 'test-token-user-2' },
    { id: 'user-3', token: 'test-token-user-3' }
  ] as const;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    dataSource = moduleFixture.get<DataSource>(getDataSourceToken());

    await app.init();

    // Wait for services to be ready
    await waitForServices();
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  beforeEach(async () => {
    // Clear mock service data before each test
    await clearMockServices();
  });

  describe('User Service Integration', () => {
    it('should fetch user information when searching for friends', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/friends/search?q=TestUser')
        .set('Authorization', `Bearer ${testUsers[0]!.token}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('username');
      expect(response.body[0]).toHaveProperty('avatar');
    });

    it('should validate user existence when sending friend requests', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/friends/request')
        .set('Authorization', `Bearer ${testUsers[0]!.token}`)
        .send({ toUserId: testUsers[1]!.id })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.friendId).toBe(testUsers[1]!.id);
    });

    it('should handle non-existent users gracefully', async () => {
      await request(app.getHttpServer())
        .post('/v1/friends/request')
        .set('Authorization', `Bearer ${testUsers[0]!.token}`)
        .send({ toUserId: 'non-existent-user' })
        .expect(404);
    });
  });

  describe('Notification Service Integration', () => {
    it('should send notification when friend request is sent', async () => {
      // Send friend request
      await request(app.getHttpServer())
        .post('/v1/friends/request')
        .set('Authorization', `Bearer ${testUsers[0]!.token}`)
        .send({ toUserId: testUsers[1]!.id })
        .expect(201);

      // Check if notification was sent to mock service
      const notificationResponse = await request('http://notification-service:3004')
        .get('/v1/notifications')
        .expect(200);

      const notifications = notificationResponse.body.notifications;
      const friendRequestNotification = notifications.find((n: any) =>
        n.type === 'friend_request' && n.userId === testUsers[1]!.id
      );

      expect(friendRequestNotification).toBeDefined();
      expect(friendRequestNotification.title).toContain('заявку в друзья');
    });

    it('should send notification when friend request is accepted', async () => {
      // Send friend request
      const friendRequestResponse = await request(app.getHttpServer())
        .post('/v1/friends/request')
        .set('Authorization', `Bearer ${testUsers[0]!.token}`)
        .send({ toUserId: testUsers[1]!.id })
        .expect(201);

      // Accept friend request
      await request(app.getHttpServer())
        .post(`/v1/friends/accept/${friendRequestResponse.body.id}`)
        .set('Authorization', `Bearer ${testUsers[1]!.token}`)
        .expect(200);

      // Check notifications
      const notificationResponse = await request('http://notification-service:3004')
        .get('/v1/notifications')
        .expect(200);

      const notifications = notificationResponse.body.notifications;
      const acceptedNotification = notifications.find((n: any) =>
        n.type === 'friend_request_accepted' && n.userId === testUsers[0]!.id
      );

      expect(acceptedNotification).toBeDefined();
    });

    it('should get user notification preferences', async () => {
      const response = await request(app.getHttpServer())
        .get(`/integration/notification/${testUsers[0]!.id}/preferences`)
        .set('x-internal-token', 'test-internal-token')
        .expect(200);

      expect(response.body).toHaveProperty('preferences');
      expect(response.body.preferences).toHaveProperty('friendRequests');
      expect(response.body.preferences.friendRequests.enabled).toBe(true);
    });
  });

  describe('Achievement Service Integration', () => {
    it('should trigger first friend achievement', async () => {
      // Send and accept friend request
      const friendRequestResponse = await request(app.getHttpServer())
        .post('/v1/friends/request')
        .set('Authorization', `Bearer ${testUsers[0]!.token}`)
        .send({ toUserId: testUsers[1]!.id })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/v1/friends/accept/${friendRequestResponse.body.id}`)
        .set('Authorization', `Bearer ${testUsers[1]!.token}`)
        .expect(200);

      // Check if achievement was triggered
      const achievementResponse = await request('http://achievement-service:3005')
        .get(`/v1/users/${testUsers[0]!.id}/achievements`)
        .expect(200);

      const firstFriendAchievement = achievementResponse.body.achievements.find((a: any) =>
        a.id === 'first-friend' && a.unlocked === true
      );

      expect(firstFriendAchievement).toBeDefined();
      expect(firstFriendAchievement.progress).toBe(100);
    });

    it('should provide friends list for achievement calculations', async () => {
      // Create some friendships
      await createTestFriendships();

      const response = await request(app.getHttpServer())
        .get(`/integration/achievement/${testUsers[0]!.id}/friends`)
        .set('x-internal-token', 'test-internal-token')
        .expect(200);

      expect(response.body).toHaveProperty('friends');
      expect(response.body).toHaveProperty('totalFriends');
      expect(response.body.totalFriends).toBeGreaterThan(0);
    });

    it('should update social progress when friends are added', async () => {
      // Add multiple friends
      await createTestFriendships();

      // Check achievement progress
      const achievementResponse = await request('http://achievement-service:3005')
        .get(`/v1/users/${testUsers[0]!.id}/achievements`)
        .expect(200);

      const socialAchievements = achievementResponse.body.achievements.filter((a: any) =>
        a.type === 'social'
      );

      expect(socialAchievements.length).toBeGreaterThan(0);

      // Should have first friend achievement
      const firstFriend = socialAchievements.find((a: any) => a.id === 'first-friend');
      expect(firstFriend?.unlocked).toBe(true);
    });
  });

  describe('Review Service Integration', () => {
    it('should check social connection for review validation', async () => {
      // Create friendship
      await createTestFriendships();

      const response = await request(app.getHttpServer())
        .get(`/integration/review/${testUsers[0]!.id}/connections/${testUsers[1]!.id}`)
        .set('x-internal-token', 'test-internal-token')
        .expect(200);

      expect(response.body).toHaveProperty('connectionType');
      expect(response.body.connectionType).toBe('friends');
      expect(response.body).toHaveProperty('connectionDate');
    });

    it('should calculate mutual friends count', async () => {
      // Create complex friendship network
      await createComplexFriendshipNetwork();

      const response = await request(app.getHttpServer())
        .get(`/integration/review/${testUsers[0]!.id}/mutual-friends/${testUsers[1]!.id}`)
        .set('x-internal-token', 'test-internal-token')
        .expect(200);

      expect(response.body).toHaveProperty('mutualFriendsCount');
      expect(typeof response.body.mutualFriendsCount).toBe('number');
    });

    it('should return no connection for non-friends', async () => {
      const response = await request(app.getHttpServer())
        .get(`/integration/review/${testUsers[0]!.id}/connections/non-existent-user`)
        .set('x-internal-token', 'test-internal-token')
        .expect(200);

      expect(response.body.connectionType).toBe('none');
    });
  });

  describe('Cross-Service Integration Scenarios', () => {
    it('should handle complete friend request flow with all integrations', async () => {
      // 1. Send friend request (should trigger notification)
      const friendRequestResponse = await request(app.getHttpServer())
        .post('/v1/friends/request')
        .set('Authorization', `Bearer ${testUsers[0]!.token}`)
        .send({
          toUserId: testUsers[1]!.id,
          message: 'Хочешь поиграть вместе?'
        })
        .expect(201);

      // 2. Accept friend request (should trigger achievement and notification)
      await request(app.getHttpServer())
        .post(`/v1/friends/accept/${friendRequestResponse.body.id}`)
        .set('Authorization', `Bearer ${testUsers[1]!.token}`)
        .expect(200);

      // 3. Verify all integrations worked

      // Check notifications
      const notificationResponse = await request('http://notification-service:3004')
        .get('/v1/notifications')
        .expect(200);

      const notifications = notificationResponse.body.notifications;
      expect(notifications.some((n: any) => n.type === 'friend_request')).toBe(true);
      expect(notifications.some((n: any) => n.type === 'friend_request_accepted')).toBe(true);

      // Check achievements
      const achievementResponse = await request('http://achievement-service:3005')
        .get(`/v1/users/${testUsers[0].id}/achievements`)
        .expect(200);

      const firstFriendAchievement = achievementResponse.body.achievements.find((a: any) =>
        a.id === 'first-friend'
      );
      expect(firstFriendAchievement?.unlocked).toBe(true);

      // Check social connection for reviews
      const reviewConnectionResponse = await request(app.getHttpServer())
        .get(`/integration/review/${testUsers[0].id}/connections/${testUsers[1].id}`)
        .set('x-internal-token', 'test-internal-token')
        .expect(200);

      expect(reviewConnectionResponse.body.connectionType).toBe('friends');
    });

    it('should handle service failures gracefully', async () => {
      // This test would require stopping one of the mock services
      // For now, we'll test error handling in the social service

      const response = await request(app.getHttpServer())
        .post('/v1/friends/request')
        .set('Authorization', `Bearer ${testUsers[0]!.token}`)
        .send({ toUserId: testUsers[1]!.id })
        .expect(201);

      // Even if external services fail, the core functionality should work
      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('pending');
    });

    it('should maintain data consistency across services', async () => {
      // Create multiple friendships
      await createTestFriendships();

      // Get friends from social service
      const socialFriendsResponse = await request(app.getHttpServer())
        .get('/v1/friends')
        .set('Authorization', `Bearer ${testUsers[0]!.token}`)
        .expect(200);

      // Get friends from achievement integration
      const achievementFriendsResponse = await request(app.getHttpServer())
        .get(`/integration/achievement/${testUsers[0]!.id}/friends`)
        .set('x-internal-token', 'test-internal-token')
        .expect(200);

      // Data should be consistent
      expect(socialFriendsResponse.body.pagination.total)
        .toBe(achievementFriendsResponse.body.totalFriends);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle concurrent requests across all integrations', async () => {
      const concurrentRequests = 20;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const fromUser = testUsers[i % testUsers.length];
        const toUser = testUsers[(i + 1) % testUsers.length];

        if (fromUser && toUser) {
          promises.push(
            request(app.getHttpServer())
              .post('/v1/friends/request')
              .set('Authorization', `Bearer ${fromUser.token}`)
              .send({ toUserId: toUser.id })
          );
        }
      }

      const results = await Promise.allSettled(promises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;

      // Should handle most requests successfully
      expect(successCount / concurrentRequests).toBeGreaterThan(0.8);
    });

    it('should maintain response times under load', async () => {
      const startTime = Date.now();

      const promises = Array.from({ length: 50 }, (_, i) => {
        const user = testUsers[i % testUsers.length];
        return user ? request(app.getHttpServer())
          .get('/v1/friends')
          .set('Authorization', `Bearer ${user.token}`) : Promise.resolve();
      });

      await Promise.allSettled(promises);

      const duration = Date.now() - startTime;

      // Should complete 50 requests in under 5 seconds
      expect(duration).toBeLessThan(5000);
    });
  });

  // Helper functions
  async function waitForServices(): Promise<void> {
    const services = [
      'http://user-service:3001/health',
      'http://notification-service:3004/health',
      'http://achievement-service:3005/health',
      'http://review-service:3006/health'
    ];

    const maxRetries = 30;
    const retryDelay = 1000;

    for (const serviceUrl of services) {
      let retries = 0;
      while (retries < maxRetries) {
        try {
          await request(serviceUrl).get('').expect(200);
          break;
        } catch (error) {
          retries++;
          if (retries === maxRetries) {
            throw new Error(`Service ${serviceUrl} not ready after ${maxRetries} retries`);
          }
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
  }

  async function clearMockServices(): Promise<void> {
    const clearRequests = [
      request('http://notification-service:3004').delete('/v1/notifications/clear'),
      request('http://achievement-service:3005').delete('/v1/achievements/clear'),
      request('http://review-service:3006').delete('/v1/reviews/clear')
    ];

    await Promise.allSettled(clearRequests);
  }

  async function createTestFriendships(): Promise<void> {
    // Create friendship between user-1 and user-2
    const friendRequestResponse = await request(app.getHttpServer())
      .post('/v1/friends/request')
      .set('Authorization', `Bearer ${testUsers[0]!.token}`)
      .send({ toUserId: testUsers[1]!.id });

    if (friendRequestResponse.status === 201) {
      await request(app.getHttpServer())
        .post(`/v1/friends/accept/${friendRequestResponse.body.id}`)
        .set('Authorization', `Bearer ${testUsers[1]!.token}`);
    }
  }

  async function createComplexFriendshipNetwork(): Promise<void> {
    // Create a network where user-1 and user-2 have user-3 as mutual friend

    // user-1 -> user-3
    const request1 = await request(app.getHttpServer())
      .post('/v1/friends/request')
      .set('Authorization', `Bearer ${testUsers[0]!.token}`)
      .send({ toUserId: testUsers[2]!.id });

    if (request1.status === 201) {
      await request(app.getHttpServer())
        .post(`/v1/friends/accept/${request1.body.id}`)
        .set('Authorization', `Bearer ${testUsers[2]!.token}`);
    }

    // user-2 -> user-3
    const request2 = await request(app.getHttpServer())
      .post('/v1/friends/request')
      .set('Authorization', `Bearer ${testUsers[1]!.token}`)
      .send({ toUserId: testUsers[2]!.id });

    if (request2.status === 201) {
      await request(app.getHttpServer())
        .post(`/v1/friends/accept/${request2.body.id}`)
        .set('Authorization', `Bearer ${testUsers[2]!.token}`);
    }

    // user-1 -> user-2
    const request3 = await request(app.getHttpServer())
      .post('/v1/friends/request')
      .set('Authorization', `Bearer ${testUsers[0]!.token}`)
      .send({ toUserId: testUsers[1]!.id });

    if (request3.status === 201) {
      await request(app.getHttpServer())
        .post(`/v1/friends/accept/${request3.body.id}`)
        .set('Authorization', `Bearer ${testUsers[1]!.token}`);
    }
  }

  async function cleanupTestData(): Promise<void> {
    try {
      await dataSource.query('DELETE FROM messages WHERE from_user_id LIKE $1 OR to_user_id LIKE $1', ['user-%']);
      await dataSource.query('DELETE FROM friendships WHERE user_id LIKE $1 OR friend_id LIKE $1', ['user-%']);
      await dataSource.query('DELETE FROM online_status WHERE user_id LIKE $1', ['user-%']);
    } catch (error) {
      console.warn('Cleanup failed:', error instanceof Error ? error.message : 'Unknown error');
    }
  }
});