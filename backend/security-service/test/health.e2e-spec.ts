import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';

describe('Security Service - Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health/live (GET) should return ok', async () => {
    const res = await request(app.getHttpServer()).get('/health/live').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('/health/ready (GET) should return ok', async () => {
    const res = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(res.body.status).toBe('ok');
  });
});
