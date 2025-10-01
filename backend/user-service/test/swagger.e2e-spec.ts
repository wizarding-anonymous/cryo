import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';

describe('Swagger Documentation (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Create a mock RedisService
    const mockRedisService = {
      blacklistToken: jest.fn().mockResolvedValue(undefined),
      isTokenBlacklisted: jest.fn().mockResolvedValue(false),
      cacheUserSession: jest.fn().mockResolvedValue(undefined),
      getUserSession: jest.fn().mockResolvedValue(null),
      removeUserSession: jest.fn().mockResolvedValue(undefined),
      healthCheck: jest.fn().mockResolvedValue(true),
    };

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
      .overrideProvider('RedisService')
      .useValue(mockRedisService)
      .compile();

    app = moduleFixture.createNestApplication();

    // Set global prefix like in main.ts
    app.setGlobalPrefix('api');

    // Setup Swagger documentation like in main.ts
    const config = new DocumentBuilder()
      .setTitle('User Service API')
      .setDescription('API documentation for the User Service microservice')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/api-docs', app, document);

    await app.init();
  }, 10000);

  afterAll(async () => {
    await app.close();
  });

  it('should serve Swagger documentation at /api/api-docs', () => {
    return request(app.getHttpServer())
      .get('/api/api-docs')
      .expect(200)
      .then((res) => {
        // Check that it returns HTML content (Swagger UI)
        expect(res.headers['content-type']).toMatch(/text\/html/);
        expect(res.text).toContain('swagger-ui');
      });
  });

  it('should serve Swagger JSON at /api/api-docs-json', () => {
    return request(app.getHttpServer())
      .get('/api/api-docs-json')
      .expect(200)
      .then((res) => {
        expect(res.headers['content-type']).toMatch(/application\/json/);
        expect(res.body).toHaveProperty('openapi');
        expect(res.body).toHaveProperty('info');
        expect(res.body.info.title).toBe('User Service API');
        expect(res.body).toHaveProperty('paths');

        // Verify that our main endpoints are documented (with /api prefix)
        expect(res.body.paths).toHaveProperty('/api/auth/register');
        expect(res.body.paths).toHaveProperty('/api/auth/login');
        expect(res.body.paths).toHaveProperty('/api/auth/logout');
        expect(res.body.paths).toHaveProperty('/api/users/profile');
      });
  });
});
