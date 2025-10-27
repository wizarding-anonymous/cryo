import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { HttpAdapterHost } from '@nestjs/core';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { LoggingService } from '../src/common/logging/logging.service';

describe('User Endpoints (e2e) - Legacy Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply the same global pipes, filters, and interceptors as in main.ts
    const httpAdapterHost = app.get(HttpAdapterHost);
    const loggingService = app.get(LoggingService);
    app.useGlobalFilters(new GlobalExceptionFilter(httpAdapterHost, loggingService));
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  }, 10000);

  afterAll(async () => {
    if (app) {
      try {
        await app.close();
      } catch (error) {
        console.warn('Failed to close app:', error.message);
      }
    }
  });

  describe('Legacy User Profile Tests (Deprecated)', () => {
    it('should skip auth-dependent tests - Auth Service moved to separate microservice', async () => {
      console.log('ℹ️  These tests have been moved to user-auth-integration.e2e-spec.ts');
      console.log('ℹ️  Auth functionality is now handled by a separate Auth Service microservice');
      console.log('ℹ️  Use the new integration tests for testing with real Auth Service');
      
      // This test always passes to indicate the migration
      expect(true).toBe(true);
    });

    it('should redirect to internal API tests for user management', async () => {
      console.log('ℹ️  User management is now handled via internal APIs');
      console.log('ℹ️  See user-internal.e2e-spec.ts for internal API tests');
      console.log('ℹ️  See user-auth-integration.e2e-spec.ts for auth integration tests');
      
      // This test always passes to indicate the migration
      expect(true).toBe(true);
    });
  });

  describe('Service Health Check', () => {
    it('should verify User Service is running', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      console.log('✅ User Service is running and healthy');
    });

    it('should verify API prefix is working', async () => {
      const response = await request(app.getHttpServer())
        .get('/api')
        .expect(200);

      expect(response.body).toHaveProperty('message');
      console.log('✅ API prefix is configured correctly');
    });
  });
});