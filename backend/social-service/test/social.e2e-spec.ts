import { INestApplication, ValidationPipe, ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { Friendship } from '../src/friends/entities/friendship.entity';
import { Message } from '../src/messages/entities/message.entity';
import { OnlineStatus } from '../src/status/entities/online-status.entity';
import { FriendsModule } from '../src/friends/friends.module';
import { MessagesModule } from '../src/messages/messages.module';
import { StatusModule } from '../src/status/status.module';
import { HealthModule } from '../src/common/health/health.module';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { AuthRequest } from '../src/common/interfaces/auth-request.interface';
import { UserServiceClient } from '../src/clients/user.service.client';
import { NotificationServiceClient } from '../src/clients/notification.service.client';
import { AchievementServiceClient } from '../src/clients/achievement.service.client';

const USERS_FIXTURE: Record<string, { id: string; username: string }> = {
  '11111111-1111-1111-1111-111111111111': {
    id: '11111111-1111-1111-1111-111111111111',
    username: 'player-one',
  },
  '22222222-2222-2222-2222-222222222222': {
    id: '22222222-2222-2222-2222-222222222222',
    username: 'player-two',
  },
};

describe('Social Service E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let postgresContainer: StartedPostgreSqlContainer;

  const userClientMock = {
    getUsersByIds: jest.fn(async (ids: string[]) =>
      ids
        .map((id) => USERS_FIXTURE[id])
        .filter((user): user is { id: string; username: string } => !!user),
    ),
    checkUserExists: jest.fn(async (id: string) => Boolean(USERS_FIXTURE[id])),
    searchUsers: jest.fn(async (query: string, currentUserId: string) =>
      Object.values(USERS_FIXTURE).filter(
        (user) => user.username.includes(query) && user.id !== currentUserId,
      ),
    ),
  };

  const notificationClientMock = {
    sendNotification: jest.fn().mockResolvedValue(undefined),
  };

  const achievementClientMock = {
    updateProgress: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    postgresContainer = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase('social_service')
      .withUsername('test-user')
      .withPassword('test-pass')
      .start();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: postgresContainer.getHost(),
          port: postgresContainer.getPort(),
          username: postgresContainer.getUsername(),
          password: postgresContainer.getPassword(),
          database: postgresContainer.getDatabase(),
          entities: [Friendship, Message, OnlineStatus],
          synchronize: true,
          logging: false,
        }),
        CacheModule.register({
          isGlobal: true,
          store: 'memory',
        }),
        FriendsModule,
        MessagesModule,
        StatusModule,
        HealthModule,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const request = context.switchToHttp().getRequest<AuthRequest>();
          const headerValue = request.headers['x-user-id'];
          const userId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
          request.user = {
            userId: userId ?? '11111111-1111-1111-1111-111111111111',
          };
          return true;
        },
      })
      .overrideProvider(UserServiceClient)
      .useValue(userClientMock as Partial<UserServiceClient>)
      .overrideProvider(NotificationServiceClient)
      .useValue(notificationClientMock as Partial<NotificationServiceClient>)
      .overrideProvider(AchievementServiceClient)
      .useValue(achievementClientMock as Partial<AchievementServiceClient>)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    dataSource = moduleFixture.get(DataSource);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    if (dataSource?.isInitialized) {
      await dataSource.synchronize(true);
    }
  });

  afterAll(async () => {
    await app?.close();
    await postgresContainer?.stop();
  });

  it('completes the core social workflow', async () => {
    const requesterId = '11111111-1111-1111-1111-111111111111';
    const recipientId = '22222222-2222-2222-2222-222222222222';

    const sendRequestResponse = await request(app.getHttpServer())
      .post('/api/friends/request')
      .set('Authorization', 'Bearer test-token')
      .set('x-user-id', requesterId)
      .send({ toUserId: recipientId })
      .expect(201);

    expect(sendRequestResponse.body).toHaveProperty('id');
    const requestId = sendRequestResponse.body.id as string;

    const pendingRequests = await request(app.getHttpServer())
      .get('/api/friends/requests')
      .set('Authorization', 'Bearer test-token')
      .set('x-user-id', recipientId)
      .expect(200);

    expect(pendingRequests.body).toHaveLength(1);
    expect(pendingRequests.body[0].id).toBe(requestId);

    await request(app.getHttpServer())
      .post(`/api/friends/accept/${requestId}`)
      .set('Authorization', 'Bearer test-token')
      .set('x-user-id', recipientId)
      .expect(201);

    expect(achievementClientMock.updateProgress).toHaveBeenCalledWith({
      userId: recipientId,
      eventType: 'friend_added',
      eventData: { friendId: requesterId },
    });

    const friendsList = await request(app.getHttpServer())
      .get('/api/friends')
      .set('Authorization', 'Bearer test-token')
      .set('x-user-id', requesterId)
      .expect(200);

    expect(friendsList.body.friends).toHaveLength(1);
    expect(friendsList.body.friends[0].friendId).toBe(recipientId);
    expect(friendsList.body.friends[0].friendInfo.username).toBe('player-two');

    const messageResponse = await request(app.getHttpServer())
      .post('/api/messages')
      .set('Authorization', 'Bearer test-token')
      .set('x-user-id', requesterId)
      .send({ toUserId: recipientId, content: 'Hello there!' })
      .expect(201);

    const messageId = messageResponse.body.id as string;
    expect(messageResponse.body.content).toBe('Hello there!');

    await request(app.getHttpServer())
      .put(`/api/messages/${messageId}/read`)
      .set('Authorization', 'Bearer test-token')
      .set('x-user-id', recipientId)
      .expect(204);

    const conversationResponse = await request(app.getHttpServer())
      .get(`/api/messages/conversations/${requesterId}`)
      .set('Authorization', 'Bearer test-token')
      .set('x-user-id', recipientId)
      .expect(200);

    expect(conversationResponse.body.messages).toHaveLength(1);
    expect(conversationResponse.body.messages[0].content).toBe('Hello there!');

    await request(app.getHttpServer())
      .put('/api/status/online')
      .set('Authorization', 'Bearer test-token')
      .set('x-user-id', requesterId)
      .send({ currentGame: 'Cyber Quest' })
      .expect(204);

    const friendsStatusResponse = await request(app.getHttpServer())
      .get('/api/status/friends')
      .set('Authorization', 'Bearer test-token')
      .set('x-user-id', recipientId)
      .expect(200);

    expect(friendsStatusResponse.body).toHaveLength(1);
    expect(friendsStatusResponse.body[0]).toMatchObject({
      userId: requesterId,
      status: 'online',
      currentGame: 'Cyber Quest',
    });

    expect(notificationClientMock.sendNotification).toHaveBeenCalled();
  });
});
