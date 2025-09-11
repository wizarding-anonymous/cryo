import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { HttpAdapterHost } from '@nestjs/core';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

describe('Profile and Auth Flow (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply the same global pipes, filters, and interceptors as in main.ts
    const httpAdapterHost = app.get(HttpAdapterHost);
    app.useGlobalFilters(new GlobalExceptionFilter(httpAdapterHost));
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('User Lifecycle', () => {
    const user = {
      name: 'E2E Test User',
      email: `e2e-${Date.now()}@test.com`,
      password: 'password123',
    };
    let accessToken: string;

    it('POST /auth/register - should register a new user', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(user)
        .expect(201)
        .then((res) => {
          expect(res.body.data).toBeDefined();
          expect(res.body.data.user.email).toEqual(user.email);
          expect(res.body.data).toHaveProperty('accessToken');
        });
    });

    it('POST /auth/login - should log the user in and return a new token', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(200)
        .then((res) => {
          expect(res.body.data).toHaveProperty('accessToken');
          accessToken = res.body.data.accessToken;
        });
    });

    it('GET /profile - should get the user profile with a valid token', () => {
      return request(app.getHttpServer())
        .get('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body.data.email).toEqual(user.email);
          expect(res.body.data.name).toEqual(user.name);
        });
    });

    it('PUT /profile - should update the user profile', () => {
      const newName = 'E2E Test User Updated';
      return request(app.getHttpServer())
        .put('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: newName })
        .expect(200)
        .then((res) => {
          expect(res.body.data.name).toEqual(newName);
        });
    });

    it('POST /auth/logout - should blacklist the token', () => {
      return request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
    });

    it('GET /profile - should fail with the blacklisted token', () => {
      return request(app.getHttpServer())
        .get('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401)
        .then((res) => {
            expect(res.body.error.code).toEqual('UNAUTHENTICATED');
        });
    });

    it('DELETE /profile - should delete the user account', async () => {
      // Log in again to get a fresh token
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: user.password });

      const freshToken = loginRes.body.data.accessToken;

      // Delete the account
      await request(app.getHttpServer())
        .delete('/profile')
        .set('Authorization', `Bearer ${freshToken}`)
        .expect(204);

      // Verify user can no longer log in
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(401);
    });
  });
});
