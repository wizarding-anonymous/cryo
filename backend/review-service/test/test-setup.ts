import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from '../src/filters';
import { validationConfig } from '../src/config/validation.config';

// Test setup for E2E tests

// Test database configuration
export const testDatabaseConfig = {
  type: 'sqlite' as const,
  database: ':memory:',
  entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
  synchronize: true,
  logging: false,
};

// Test cache configuration
export const testCacheConfig = {
  store: 'memory',
  ttl: 60,
  max: 100,
};

// Test environment configuration
export const testEnvConfig = {
  NODE_ENV: 'test',
  PORT: '3001',
  DATABASE_URL: 'sqlite::memory:',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'test-secret',
  LIBRARY_SERVICE_URL: 'http://localhost:3002',
  ACHIEVEMENT_SERVICE_URL: 'http://localhost:3003',
  NOTIFICATION_SERVICE_URL: 'http://localhost:3004',
  GAME_CATALOG_SERVICE_URL: 'http://localhost:3005',
};

export async function createTestApp(moduleMetadata: any): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [
          () => ({
            database: testDatabaseConfig,
            redis: testCacheConfig,
            app: {
              port: 3001,
              environment: 'test',
              api: {
                prefix: 'api/v1',
                title: 'Review Service API',
                description: 'API for managing game reviews and ratings',
                version: '1.0.0',
              },
            },
          }),
        ],
      }),
      TypeOrmModule.forRoot(testDatabaseConfig),
      CacheModule.register(testCacheConfig),
      ...moduleMetadata.imports,
    ],
    controllers: moduleMetadata.controllers || [],
    providers: moduleMetadata.providers || [],
  })
    .overrideProvider('HttpService')
    .useValue({
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
    })
    .compile();

  const app = moduleFixture.createNestApplication();

  // Apply global pipes and filters
  app.useGlobalPipes(new ValidationPipe(validationConfig));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix('api/v1');

  await app.init();
  return app;
}

export function mockExternalServices() {
  return {
    libraryService: {
      checkGameOwnership: jest.fn(),
      getUserOwnedGames: jest.fn(),
    },
    achievementService: {
      notifyFirstReview: jest.fn(),
    },
    notificationService: {
      notifyReviewAction: jest.fn(),
    },
    gameCatalogService: {
      updateGameRating: jest.fn(),
      validateGameExists: jest.fn(),
      getGameInfo: jest.fn(),
    },
  };
}

// Helper function to create mock user context
export function createMockUser(userId: string = 'test-user-123') {
  return {
    userId,
    username: 'testuser',
    email: 'test@example.com',
  };
}

// Helper function to create mock JWT token
export function createMockJwtToken(userId: string = 'test-user-123') {
  return `Bearer mock-jwt-token-${userId}`;
}

// Helper function to setup database with test data
export async function setupTestData(app: INestApplication) {
  // This would be implemented based on your specific test data needs
  // For now, we'll return empty setup
  return {
    testReviews: [],
    testRatings: [],
  };
}

// Helper function to cleanup test data
export async function cleanupTestData(app: INestApplication) {
  // Cleanup logic would go here
  // For in-memory SQLite, this happens automatically when app closes
}