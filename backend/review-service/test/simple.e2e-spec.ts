import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { of } from 'rxjs';

import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { ReviewController, RatingController } from '../src/controllers';
import { ReviewService, RatingService, OwnershipService, MetricsService } from '../src/services';
import { Review, GameRating } from '../src/entities';
import { HttpExceptionFilter } from '../src/filters';
import { JwtAuthGuard } from '../src/guards/jwt-auth.guard';
import { OwnershipGuard } from '../src/guards/ownership.guard';

describe('Simple E2E Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        HttpModule,
      ],
      controllers: [AppController, ReviewController, RatingController],
      providers: [
        AppService,
        ReviewService,
        RatingService,
        OwnershipService,
        MetricsService,
        {
          provide: getRepositoryToken(Review),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              select: jest.fn().mockReturnThis(),
              addSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              getRawOne: jest.fn(),
            })),
          },
        },
        {
          provide: getRepositoryToken(GameRating),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(() => of({
              data: { owned: true },
              status: 200,
              statusText: 'OK',
              headers: {},
              config: {},
            })),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config = {
                'LIBRARY_SERVICE_URL': 'http://library-service:3000',
                'OWNERSHIP_REQUEST_TIMEOUT': 5000,
                'OWNERSHIP_MAX_RETRIES': 3,
                'OWNERSHIP_CACHE_TIMEOUT': 600,
                'OWNERSHIP_NEGATIVE_CACHE_TIMEOUT': 300,
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    })
    .overrideGuard(JwtAuthGuard)
    .useValue({
      canActivate: () => true, // Allow all requests in simple tests
    })
    .overrideGuard(OwnershipGuard)
    .useValue({
      canActivate: () => true, // Allow all requests in simple tests
    })
    .compile();

    app = moduleFixture.createNestApplication();
    
    app.useGlobalPipes(new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }));
    
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Health Endpoints', () => {
    it('/ (GET) should return Hello World', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect('Hello World!');
    });

    it('/health (GET) should return health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('API Validation', () => {
    it('should return 404 for non-existent endpoints', () => {
      return request(app.getHttpServer())
        .get('/non-existent')
        .expect(404);
    });

    it('should validate review creation input', async () => {
      const invalidReview = {
        gameId: 'game-123',
        text: 'Short', // Too short
        rating: 6, // Invalid rating
      };

      await request(app.getHttpServer())
        .post('/reviews')
        .send(invalidReview)
        .expect(400);
    });

    it('should validate pagination parameters', async () => {
      await request(app.getHttpServer())
        .get('/reviews/game/game-123')
        .query({ page: -1, limit: 1000 }) // Invalid pagination
        .expect(400);
    });
  });

  describe('Rating Endpoints', () => {
    it('should handle game rating requests', async () => {
      const gameId = 'test-game-123';
      
      // Mock no rating found
      const cacheManager = app.get(CACHE_MANAGER);
      const gameRatingRepository = app.get(getRepositoryToken(GameRating));
      
      cacheManager.get.mockResolvedValue(null);
      gameRatingRepository.findOne.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get(`/ratings/game/${gameId}`)
        .expect(200);

      expect(response.body).toEqual({
        gameId,
        averageRating: 0,
        totalReviews: 0,
        message: 'No reviews yet',
      });
    });
  });
});