import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';

describe('Swagger Documentation (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    })
      .overrideProvider('CACHE_MANAGER')
      .useValue({
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        reset: jest.fn().mockResolvedValue(undefined),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  }, 10000);

  afterAll(async () => {
    await app.close();
  });

  it('should serve Swagger documentation at /api-docs', () => {
    return request(app.getHttpServer())
      .get('/api-docs')
      .expect(200)
      .then((res) => {
        // Check that it returns HTML content (Swagger UI)
        expect(res.headers['content-type']).toMatch(/text\/html/);
        expect(res.text).toContain('swagger-ui');
      });
  });

  it('should serve Swagger JSON at /api-docs-json', () => {
    return request(app.getHttpServer())
      .get('/api-docs-json')
      .expect(200)
      .then((res) => {
        expect(res.headers['content-type']).toMatch(/application\/json/);
        expect(res.body).toHaveProperty('openapi');
        expect(res.body).toHaveProperty('info');
        expect(res.body.info.title).toBe('User Service API');
        expect(res.body).toHaveProperty('paths');

        // Verify that our main endpoints are documented
        expect(res.body.paths).toHaveProperty('/auth/register');
        expect(res.body.paths).toHaveProperty('/auth/login');
        expect(res.body.paths).toHaveProperty('/auth/logout');
        expect(res.body.paths).toHaveProperty('/profile');
        expect(res.body.paths).toHaveProperty('/users/profile');
      });
  });
});
