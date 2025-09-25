import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { of } from 'rxjs';

import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { ReviewController, RatingController } from '../src/controllers';
import { ReviewService, RatingService, OwnershipService, MetricsService } from '../src/services';
import { Review, GameRating } from '../src/entities';
import { HttpExceptionFilter } from '../src/filters';
import { JwtAuthGuard } from '../src/guards/jwt-auth.guard';
import { OwnershipGuard } from '../src/guards/ownership.guard';

describe('Review Service E2E Tests', () => {
  let app: INestApplication<App>;
  let reviewRepository: Repository<Review>;
  let gameRatingRepository: Repository<GameRating>;
  let cacheManager: Cache;
  let ownershipService: OwnershipService;

  // Mock data
  const mockUser = { id: 'user-123', email: 'test@example.com' };
  const mockGameId = 'game-456';
  const mockReviewData = {
    gameId: mockGameId,
    text: 'This is an amazing game with great graphics and gameplay!',
    rating: 5,
  };

  beforeAll(async () => {
    // Create test module with mocked dependencies
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
      canActivate: (context: any) => {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer mock-jwt-token')) {
          const token = authHeader.replace('Bearer ', '');
          const userId = token.replace('mock-jwt-token-', '') || mockUser.id;
          request.user = { id: userId, email: `${userId}@example.com` };
          return true;
        }
        return false;
      },
    })
    .overrideGuard(OwnershipGuard)
    .useValue({
      canActivate: () => true, // Allow all requests in tests
    })
    .compile();

    app = moduleFixture.createNestApplication();

    // Configure app like in main.ts
    app.useGlobalPipes(new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }));

    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();

    // Get repository instances for test setup
    reviewRepository = moduleFixture.get<Repository<Review>>(getRepositoryToken(Review));
    gameRatingRepository = moduleFixture.get<Repository<GameRating>>(getRepositoryToken(GameRating));
    cacheManager = moduleFixture.get<Cache>(CACHE_MANAGER);
    ownershipService = moduleFixture.get<OwnershipService>(OwnershipService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('Health Check', () => {
    it('/ (GET) should return Hello World', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect('Hello World!');
    });

    it('/health (GET) should return health status', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res: any) => {
          expect(res.body).toHaveProperty('status', 'ok');
          expect(res.body).toHaveProperty('timestamp');
        });
    });
  });

  describe('Review Creation Flow (E2E)', () => {
    it('should create a review successfully when user owns the game', async () => {
      // Mock ownership verification
      jest.spyOn(ownershipService, 'checkGameOwnership').mockResolvedValue(true);

      // Mock no existing review
      (reviewRepository.findOne as jest.Mock).mockResolvedValue(null);

      // Mock review creation
      const mockReview = {
        id: 'review-123',
        userId: mockUser.id,
        ...mockReviewData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (reviewRepository.create as jest.Mock).mockReturnValue(mockReview);
      (reviewRepository.save as jest.Mock).mockResolvedValue(mockReview);

      // Mock rating calculation
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          averageRating: '5.0',
          totalReviews: '1',
        }),
      };
      (reviewRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);

      // Mock rating update
      const mockGameRating = {
        gameId: mockGameId,
        averageRating: 5.0,
        totalReviews: 1,
        updatedAt: new Date(),
      };
      (gameRatingRepository.findOne as jest.Mock).mockResolvedValue(null);
      (gameRatingRepository.create as jest.Mock).mockReturnValue(mockGameRating);
      (gameRatingRepository.save as jest.Mock).mockResolvedValue(mockGameRating);
      
      // Mock cache operations
      (cacheManager.del as jest.Mock).mockResolvedValue(true);

      const response = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', 'Bearer mock-jwt-token')
        .send(mockReviewData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        userId: mockUser.id,
        gameId: mockGameId,
        text: mockReviewData.text,
        rating: mockReviewData.rating,
      });
    });

    it('should reject review creation when user does not own the game', async () => {
      // Mock ownership verification failure
      jest.spyOn(ownershipService, 'checkGameOwnership').mockResolvedValue(false);

      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', 'Bearer mock-jwt-token')
        .send(mockReviewData)
        .expect(403)
        .expect((res: any) => {
          expect(res.body.error.message).toContain('must own the game');
        });
    });

    it('should reject duplicate review creation', async () => {
      // Mock ownership verification
      jest.spyOn(ownershipService, 'checkGameOwnership').mockResolvedValue(true);

      // Mock existing review
      const existingReview = {
        id: 'existing-review',
        userId: mockUser.id,
        gameId: mockGameId,
        text: 'Previous review',
        rating: 4,
      };
      (reviewRepository.findOne as jest.Mock).mockResolvedValue(existingReview);

      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', 'Bearer mock-jwt-token')
        .send(mockReviewData)
        .expect(409)
        .expect((res: any) => {
          expect(res.body.error.message).toContain('already reviewed');
        });
    });
  });

  describe('Review Retrieval (E2E)', () => {
    it('should get game reviews with pagination', async () => {
      const mockReviews = [
        {
          id: 'review-1',
          userId: 'user-1',
          gameId: mockGameId,
          text: 'Great game!',
          rating: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'review-2',
          userId: 'user-2',
          gameId: mockGameId,
          text: 'Good game!',
          rating: 4,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (reviewRepository.findAndCount as jest.Mock).mockResolvedValue([mockReviews, 2]);

      const response = await request(app.getHttpServer())
        .get(`/reviews/game/${mockGameId}`)
        .set('Authorization', 'Bearer mock-jwt-token')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toEqual({
        reviews: expect.arrayContaining([
          expect.objectContaining({
            id: 'review-1',
            text: 'Great game!',
            rating: 5,
          }),
          expect.objectContaining({
            id: 'review-2',
            text: 'Good game!',
            rating: 4,
          }),
        ]),
        total: 2,
      });
    });

    it('should return empty array when no reviews exist', async () => {
      (reviewRepository.findAndCount as jest.Mock).mockResolvedValue([[], 0]);

      const response = await request(app.getHttpServer())
        .get(`/reviews/game/${mockGameId}`)
        .set('Authorization', 'Bearer mock-jwt-token')
        .expect(200);

      expect(response.body).toEqual({
        reviews: [],
        total: 0,
      });
    });
  });

  describe('Game Rating Retrieval (E2E)', () => {
    it('should get cached game rating', async () => {
      const mockRating = {
        gameId: mockGameId,
        averageRating: 4.5,
        totalReviews: 10,
        updatedAt: new Date(),
      };

      (cacheManager.get as jest.Mock).mockResolvedValue(mockRating);

      const response = await request(app.getHttpServer())
        .get(`/ratings/game/${mockGameId}`)
        .expect(200);

      expect(response.body).toEqual({
        gameId: mockGameId,
        averageRating: 4.5,
        totalReviews: 10,
        updatedAt: mockRating.updatedAt.toISOString(),
      });
    });

    it('should return default response when no rating exists', async () => {
      (cacheManager.get as jest.Mock).mockResolvedValue(null);
      (gameRatingRepository.findOne as jest.Mock).mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get(`/ratings/game/${mockGameId}`)
        .expect(200);

      expect(response.body).toEqual({
        gameId: mockGameId,
        averageRating: 0,
        totalReviews: 0,
        message: 'No reviews yet',
      });
    });
  });

  describe('Input Validation (E2E)', () => {
    it('should reject review with invalid rating', async () => {
      const invalidReview = {
        ...mockReviewData,
        rating: 6, // Invalid: should be 1-5
      };

      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', 'Bearer mock-jwt-token')
        .send(invalidReview)
        .expect(400)
        .expect((res: any) => {
          const messages = Array.isArray(res.body.error.message) ? res.body.error.message : [res.body.error.message];
          expect(messages.some(msg => msg.toLowerCase().includes('rating'))).toBe(true);
        });
    });

    it('should reject review with short text', async () => {
      const invalidReview = {
        ...mockReviewData,
        text: 'Short', // Invalid: should be 10-1000 characters
      };

      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', 'Bearer mock-jwt-token')
        .send(invalidReview)
        .expect(400)
        .expect((res: any) => {
          const messages = Array.isArray(res.body.error.message) ? res.body.error.message : [res.body.error.message];
          expect(messages.some(msg => msg.toLowerCase().includes('text'))).toBe(true);
        });
    });

    it('should reject review with missing gameId', async () => {
      const invalidReview = {
        text: mockReviewData.text,
        rating: mockReviewData.rating,
        // Missing gameId
      };

      await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', 'Bearer mock-jwt-token')
        .send(invalidReview)
        .expect(400)
        .expect((res: any) => {
          const messages = Array.isArray(res.body.error.message) ? res.body.error.message : [res.body.error.message];
          expect(messages.some(msg => msg.toLowerCase().includes('gameid'))).toBe(true);
        });
    });
  });

  describe('Complete Review Lifecycle (E2E)', () => {
    it('should handle complete review creation and viewing scenario', async () => {
      const reviewId = 'lifecycle-review-123';

      // Step 1: Create review
      jest.spyOn(ownershipService, 'checkGameOwnership').mockResolvedValue(true);
      (reviewRepository.findOne as jest.Mock).mockResolvedValue(null);

      const createdReview = {
        id: reviewId,
        userId: mockUser.id,
        ...mockReviewData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (reviewRepository.create as jest.Mock).mockReturnValue(createdReview);
      (reviewRepository.save as jest.Mock).mockResolvedValue(createdReview);

      // Mock rating calculation
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          averageRating: '5.0',
          totalReviews: '1',
        }),
      };
      (reviewRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);

      const updatedRating = {
        gameId: mockGameId,
        averageRating: 5.0,
        totalReviews: 1,
        updatedAt: new Date(),
      };
      (gameRatingRepository.findOne as jest.Mock).mockResolvedValue(null);
      (gameRatingRepository.create as jest.Mock).mockReturnValue(updatedRating);
      (gameRatingRepository.save as jest.Mock).mockResolvedValue(updatedRating);

      // Create the review
      const createResponse = await request(app.getHttpServer())
        .post('/reviews')
        .set('Authorization', 'Bearer mock-jwt-token')
        .send(mockReviewData)
        .expect(201);

      expect(createResponse.body).toMatchObject({
        id: reviewId,
        gameId: mockGameId,
        text: mockReviewData.text,
        rating: mockReviewData.rating,
      });

      // Step 2: Verify review appears in game reviews
      (reviewRepository.findAndCount as jest.Mock).mockResolvedValue([[createdReview], 1]);

      const getReviewsResponse = await request(app.getHttpServer())
        .get(`/reviews/game/${mockGameId}`)
        .set('Authorization', 'Bearer mock-jwt-token')
        .expect(200);

      expect(getReviewsResponse.body.reviews).toHaveLength(1);
      expect(getReviewsResponse.body.reviews[0]).toMatchObject({
        id: reviewId,
        text: mockReviewData.text,
        rating: mockReviewData.rating,
      });

      // Step 3: Verify rating is updated
      (cacheManager.get as jest.Mock).mockResolvedValue(null);
      (gameRatingRepository.findOne as jest.Mock).mockResolvedValue(updatedRating);

      const getRatingResponse = await request(app.getHttpServer())
        .get(`/ratings/game/${mockGameId}`)
        .expect(200);

      expect(getRatingResponse.body).toMatchObject({
        gameId: mockGameId,
        averageRating: 5.0,
        totalReviews: 1,
      });
    });
  });
});
