import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { IntegrationModule } from './integration.module';
import { Friendship } from '../friends/entities/friendship.entity';
import { FriendshipStatus } from '../friends/entities/friendship-status.enum';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('Integration (e2e)', () => {
  let app: INestApplication;
  let friendshipRepository: Repository<Friendship>;

  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockFriendId = '123e4567-e89b-12d3-a456-426614174001';
  const mockTargetUserId = '123e4567-e89b-12d3-a456-426614174002';
  const internalToken = 'test-internal-token';

  beforeAll(async () => {
    process.env.INTERNAL_API_TOKEN = internalToken;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [Friendship],
          synchronize: true,
        }),
        IntegrationModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    friendshipRepository = moduleFixture.get<Repository<Friendship>>(
      getRepositoryToken(Friendship),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await friendshipRepository.clear();
  });

  describe('/integration/achievement/:userId/friends (GET)', () => {
    it('should return friends list for achievements', async () => {
      // Create test friendships
      const friendship1 = friendshipRepository.create({
        userId: mockUserId,
        friendId: mockFriendId,
        status: FriendshipStatus.ACCEPTED,
        requestedBy: mockUserId,
      });

      const friendship2 = friendshipRepository.create({
        userId: mockTargetUserId,
        friendId: mockUserId,
        status: FriendshipStatus.ACCEPTED,
        requestedBy: mockTargetUserId,
      });

      await friendshipRepository.save([friendship1, friendship2]);

      const response = await request(app.getHttpServer())
        .get(`/integration/achievement/${mockUserId}/friends`)
        .set('x-internal-token', internalToken)
        .expect(200);

      expect(response.body).toMatchObject({
        userId: mockUserId,
        totalFriends: 2,
      });
      expect(response.body.friendIds).toContain(mockFriendId);
      expect(response.body.friendIds).toContain(mockTargetUserId);
      expect(response.body.retrievedAt).toBeDefined();
    });

    it('should return empty list for user with no friends', async () => {
      const response = await request(app.getHttpServer())
        .get(`/integration/achievement/${mockUserId}/friends`)
        .set('x-internal-token', internalToken)
        .expect(200);

      expect(response.body).toMatchObject({
        userId: mockUserId,
        friendIds: [],
        totalFriends: 0,
      });
    });

    it('should reject request without internal token', async () => {
      await request(app.getHttpServer())
        .get(`/integration/achievement/${mockUserId}/friends`)
        .expect(401);
    });

    it('should reject request with invalid internal token', async () => {
      await request(app.getHttpServer())
        .get(`/integration/achievement/${mockUserId}/friends`)
        .set('x-internal-token', 'invalid-token')
        .expect(401);
    });
  });

  describe('/integration/review/:userId/connections/:targetUserId (GET)', () => {
    it('should return friends connection', async () => {
      const friendship = friendshipRepository.create({
        userId: mockUserId,
        friendId: mockTargetUserId,
        status: FriendshipStatus.ACCEPTED,
        requestedBy: mockUserId,
      });

      await friendshipRepository.save(friendship);

      const response = await request(app.getHttpServer())
        .get(`/integration/review/${mockUserId}/connections/${mockTargetUserId}`)
        .set('x-internal-token', internalToken)
        .expect(200);

      expect(response.body).toMatchObject({
        userId: mockUserId,
        targetUserId: mockTargetUserId,
        areFriends: true,
        connectionType: 'friends',
      });
      expect(response.body.friendshipDate).toBeDefined();
      expect(response.body.metadata.requestedBy).toBe(mockUserId);
    });

    it('should return pending connection', async () => {
      const friendship = friendshipRepository.create({
        userId: mockUserId,
        friendId: mockTargetUserId,
        status: FriendshipStatus.PENDING,
        requestedBy: mockUserId,
      });

      await friendshipRepository.save(friendship);

      const response = await request(app.getHttpServer())
        .get(`/integration/review/${mockUserId}/connections/${mockTargetUserId}`)
        .set('x-internal-token', internalToken)
        .expect(200);

      expect(response.body).toMatchObject({
        userId: mockUserId,
        targetUserId: mockTargetUserId,
        areFriends: false,
        connectionType: 'pending_request',
      });
    });

    it('should return no connection', async () => {
      const response = await request(app.getHttpServer())
        .get(`/integration/review/${mockUserId}/connections/${mockTargetUserId}`)
        .set('x-internal-token', internalToken)
        .expect(200);

      expect(response.body).toMatchObject({
        userId: mockUserId,
        targetUserId: mockTargetUserId,
        areFriends: false,
        connectionType: 'none',
      });
    });

    it('should handle same user check', async () => {
      const response = await request(app.getHttpServer())
        .get(`/integration/review/${mockUserId}/connections/${mockUserId}`)
        .set('x-internal-token', internalToken)
        .expect(200);

      expect(response.body).toMatchObject({
        userId: mockUserId,
        targetUserId: mockUserId,
        areFriends: false,
        connectionType: 'none',
        metadata: { reason: 'same_user' },
      });
    });
  });

  describe('/integration/review/:userId/mutual-friends/:targetUserId (GET)', () => {
    it('should return mutual friends count', async () => {
      // Create friendships: user1 <-> friend, user2 <-> friend
      const friendships = [
        friendshipRepository.create({
          userId: mockUserId,
          friendId: mockFriendId,
          status: FriendshipStatus.ACCEPTED,
          requestedBy: mockUserId,
        }),
        friendshipRepository.create({
          userId: mockTargetUserId,
          friendId: mockFriendId,
          status: FriendshipStatus.ACCEPTED,
          requestedBy: mockTargetUserId,
        }),
      ];

      await friendshipRepository.save(friendships);

      const response = await request(app.getHttpServer())
        .get(`/integration/review/${mockUserId}/mutual-friends/${mockTargetUserId}`)
        .set('x-internal-token', internalToken)
        .expect(200);

      expect(response.body).toMatchObject({
        mutualFriendsCount: 1,
        userId: mockUserId,
        targetUserId: mockTargetUserId,
      });
    });

    it('should return zero mutual friends', async () => {
      const response = await request(app.getHttpServer())
        .get(`/integration/review/${mockUserId}/mutual-friends/${mockTargetUserId}`)
        .set('x-internal-token', internalToken)
        .expect(200);

      expect(response.body).toMatchObject({
        mutualFriendsCount: 0,
        userId: mockUserId,
        targetUserId: mockTargetUserId,
      });
    });
  });

  describe('/integration/notification/:userId/preferences (GET)', () => {
    it('should return notification preferences', async () => {
      const response = await request(app.getHttpServer())
        .get(`/integration/notification/${mockUserId}/preferences`)
        .set('x-internal-token', internalToken)
        .expect(200);

      expect(response.body).toMatchObject({
        userId: mockUserId,
        friendRequestNotifications: true,
        messageNotifications: true,
        achievementNotifications: true,
      });
    });
  });

  describe('/integration/achievement/webhook/first-friend (POST)', () => {
    it('should accept first friend webhook', async () => {
      const webhookData = {
        userId: mockUserId,
        friendId: mockFriendId,
        timestamp: new Date().toISOString(),
      };

      await request(app.getHttpServer())
        .post('/integration/achievement/webhook/first-friend')
        .set('x-internal-token', internalToken)
        .send(webhookData)
        .expect(204);
    });

    it('should validate webhook data', async () => {
      const invalidData = {
        userId: 'invalid-uuid',
        friendId: mockFriendId,
      };

      await request(app.getHttpServer())
        .post('/integration/achievement/webhook/first-friend')
        .set('x-internal-token', internalToken)
        .send(invalidData)
        .expect(400);
    });
  });
});