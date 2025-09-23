import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';

describe('Authentication & Authorization E2E', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [TestAppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      app.setGlobalPrefix('api');
      await app.init();

      jwtService = app.get(JwtService);
    } catch (error) {
      console.error('Failed to initialize test app:', error);
      throw error;
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('JWT Authentication', () => {
    it('should reject requests without Authorization header', async () => {
      await request(app.getHttpServer())
        .get('/api/library/my')
        .expect(401);
    });

    it('should reject requests with invalid Bearer token format', async () => {
      await request(app.getHttpServer())
        .get('/api/library/my')
        .set('Authorization', 'InvalidFormat token')
        .expect(401);
    });

    it('should reject requests with malformed JWT token', async () => {
      await request(app.getHttpServer())
        .get('/api/library/my')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);
    });

    it('should reject requests with expired JWT token', async () => {
      const expiredToken = jwtService.sign(
        {
          sub: randomUUID(),
          username: 'testuser',
          roles: ['user'],
        },
        { expiresIn: '-1h' }, // Expired 1 hour ago
      );

      await request(app.getHttpServer())
        .get('/api/library/my')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    it('should accept requests with valid JWT token', async () => {
      const validToken = jwtService.sign({
        sub: randomUUID(),
        username: 'testuser',
        roles: ['user'],
      });

      await request(app.getHttpServer())
        .get('/api/library/my')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);
    });

    it('should reject JWT tokens with missing required claims', async () => {
      const invalidToken = jwtService.sign({
        username: 'testuser',
        // Missing 'sub' claim
      });

      await request(app.getHttpServer())
        .get('/api/library/my')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);
    });

    it('should handle JWT tokens with extra claims gracefully', async () => {
      const tokenWithExtraClaims = jwtService.sign({
        sub: randomUUID(),
        username: 'testuser',
        roles: ['user'],
        extraClaim: 'should be ignored',
        anotherClaim: 123,
      });

      await request(app.getHttpServer())
        .get('/api/library/my')
        .set('Authorization', `Bearer ${tokenWithExtraClaims}`)
        .expect(200);
    });
  });

  describe('Role-based Authorization', () => {
    it('should allow user role to access user endpoints', async () => {
      const userToken = jwtService.sign({
        sub: randomUUID(),
        username: 'regularuser',
        roles: ['user'],
      });

      await request(app.getHttpServer())
        .get('/api/library/my')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
    });

    it('should allow admin role to access user endpoints', async () => {
      const adminToken = jwtService.sign({
        sub: randomUUID(),
        username: 'adminuser',
        roles: ['admin', 'user'],
      });

      await request(app.getHttpServer())
        .get('/api/library/my')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should handle tokens with no roles gracefully', async () => {
      const noRolesToken = jwtService.sign({
        sub: randomUUID(),
        username: 'noroleuser',
        roles: [],
      });

      await request(app.getHttpServer())
        .get('/api/library/my')
        .set('Authorization', `Bearer ${noRolesToken}`)
        .expect(200); // Should still work for basic endpoints
    });
  });

  describe('Internal Authentication', () => {
    it('should allow internal endpoints without JWT for testing', async () => {
      // In test environment, InternalAuthGuard is mocked to always return true
      await request(app.getHttpServer())
        .post('/api/library/add')
        .send({
          userId: randomUUID(),
          gameId: randomUUID(),
          orderId: randomUUID(),
          purchaseId: randomUUID(),
          purchasePrice: 29.99,
          currency: 'USD',
          purchaseDate: new Date().toISOString(),
        })
        .expect(201);
    });
  });

  describe('Cross-User Access Prevention', () => {
    it('should prevent users from accessing other users data through token manipulation', async () => {
      const user1Id = randomUUID();
      const user2Id = randomUUID();

      const user1Token = jwtService.sign({
        sub: user1Id,
        username: 'user1',
        roles: ['user'],
      });

      // Add game for user1
      await request(app.getHttpServer())
        .post('/api/library/add')
        .send({
          userId: user1Id,
          gameId: randomUUID(),
          orderId: randomUUID(),
          purchaseId: randomUUID(),
          purchasePrice: 29.99,
          currency: 'USD',
          purchaseDate: new Date().toISOString(),
        })
        .expect(201);

      // Add game for user2
      await request(app.getHttpServer())
        .post('/api/library/add')
        .send({
          userId: user2Id,
          gameId: randomUUID(),
          orderId: randomUUID(),
          purchaseId: randomUUID(),
          purchasePrice: 19.99,
          currency: 'EUR',
          purchaseDate: new Date().toISOString(),
        })
        .expect(201);

      // User1 should only see their own library
      const user1LibraryResponse = await request(app.getHttpServer())
        .get('/api/library/my')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(user1LibraryResponse.body.games).toHaveLength(1);
      expect(user1LibraryResponse.body.games[0].userId).toBe(user1Id);
    });
  });

  describe('Token Refresh Scenarios', () => {
    it('should handle tokens close to expiration', async () => {
      const shortLivedToken = jwtService.sign(
        {
          sub: randomUUID(),
          username: 'testuser',
          roles: ['user'],
        },
        { expiresIn: '5s' }, // Very short expiration
      );

      // Should work immediately
      await request(app.getHttpServer())
        .get('/api/library/my')
        .set('Authorization', `Bearer ${shortLivedToken}`)
        .expect(200);

      // Wait for token to expire
      await new Promise((resolve) => setTimeout(resolve, 6000));

      // Should fail after expiration
      await request(app.getHttpServer())
        .get('/api/library/my')
        .set('Authorization', `Bearer ${shortLivedToken}`)
        .expect(401);
    });
  });
});