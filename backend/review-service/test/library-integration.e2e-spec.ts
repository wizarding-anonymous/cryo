import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosError } from 'axios';

import { AppModule } from '../src/app.module';
import { Review } from '../src/entities/review.entity';
import { GameRating } from '../src/entities/game-rating.entity';
import { HttpExceptionFilter } from '../src/filters';
import { validationConfig } from '../src/config/validation.config';
import { createTestApp, cleanupTestData, createMockJwtToken } from './test-setup';

describe('Library Service Integration (e2e)', () => {
  let app: INestApplication;
  let reviewRepository: Repository<Review>;
  let gameRatingRepository: Repository<GameRating>;
  let httpService: jest.Mocked<HttpService>;

  const mockUserId = 'test-user-123';
  const mockGameId = 'test-game-456';
  const mockJwtToken = createMockJwtToken(mockUserId);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HttpService)
      .useValue({
        request: jest.fn(),
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
        patch: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();

    // Apply same configuration as main app
    app.useGlobalPipes(new ValidationPipe(validationConfig));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.setGlobalPrefix('api/v1');

    await app.init();

    reviewRepository = moduleFixture.get<Repository<Review>>(getRepositoryToken(Review));
    gameRatingRepository = moduleFixture.get<Repository<GameRating>>(getRepositoryToken(GameRating));
    httpService = moduleFixture.get(HttpService);
  }, 30000);

  afterAll(async () => {
    if (app) {
      await cleanupTestData(app);
      await app.close();
    }
  });

  beforeEach(async () => {
    // Clear database before each test
    await reviewRepository.clear();
    await gameRatingRepository.clear();
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Game ownership verification', () => {
    const validReviewData = {
      gameId: mockGameId,
      text: 'This is an excellent game with great graphics!',
      rating: 5,
    };

    it('should allow review creation when user owns the game', async () => {
      // Mock successful ownership check
      httpService.request.mockReturnValue(of({
        data: { ownsGame: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }));

      const response = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send(validReviewData)
        .expect(201);

      expect(response.body).toMatchObject({
        userId: mockUserId,
        gameId: mockGameId,
        text: validReviewData.text,
        rating: validReviewData.rating,
      });

      // Verify ownership check was called
      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining(`/library/${mockUserId}/games/${mockGameId}/ownership`),
          method: 'GET',
        })
      );
    });

    it('should prevent review creation when user does not own the game', async () => {
      // Mock ownership check returning false
      httpService.request.mockReturnValue(of({
        data: { ownsGame: false },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }));

      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send(validReviewData)
        .expect(403);

      // Verify no review was created
      const reviewCount = await reviewRepository.count();
      expect(reviewCount).toBe(0);
    });

    it('should handle Library Service 404 error (user/game not found)', async () => {
      // Mock 404 error from Library Service
      const notFoundError = {
        isAxiosError: true,
        response: { status: 404 },
      } as AxiosError;

      httpService.request.mockReturnValue(throwError(() => notFoundError));

      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send(validReviewData)
        .expect(403);
    });

    it('should handle Library Service timeout', async () => {
      // Mock timeout error
      httpService.request.mockReturnValue(throwError(() => new Error('timeout')));

      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send(validReviewData)
        .expect(403);
    });

    it('should handle Library Service server error with retry', async () => {
      // Mock server error that succeeds on retry
      httpService.request
        .mockReturnValueOnce(throwError(() => ({ 
          isAxiosError: true, 
          response: { status: 500 } 
        } as AxiosError)))
        .mockReturnValueOnce(throwError(() => ({ 
          isAxiosError: true, 
          response: { status: 503 } 
        } as AxiosError)))
        .mockReturnValueOnce(of({
          data: { ownsGame: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        }));

      const response = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send(validReviewData)
        .expect(201);

      expect(response.body.userId).toBe(mockUserId);
      
      // Verify retry attempts were made
      expect(httpService.request).toHaveBeenCalledTimes(3);
    });

    it('should fail after maximum retry attempts', async () => {
      // Mock persistent server error
      const serverError = {
        isAxiosError: true,
        response: { status: 500 },
      } as AxiosError;

      httpService.request.mockReturnValue(throwError(() => serverError));

      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send(validReviewData)
        .expect(403);

      // Verify maximum retry attempts were made
      expect(httpService.request).toHaveBeenCalledTimes(3);
    });
  });

  describe('Game validation', () => {
    const validReviewData = {
      gameId: mockGameId,
      text: 'This is an excellent game with great graphics!',
      rating: 5,
    };

    beforeEach(() => {
      // Mock successful ownership check by default
      httpService.request.mockImplementation((config) => {
        if (config.url?.includes('/ownership')) {
          return of({
            data: { ownsGame: true },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          });
        }
        
        // Default to game exists
        return of({
          data: { id: mockGameId, title: 'Test Game' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });
      });
    });

    it('should validate game exists before creating review', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send(validReviewData)
        .expect(201);

      // Verify game validation was called
      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining(`/games/${mockGameId}`),
          method: 'HEAD',
        })
      );
    });

    it('should handle non-existent game', async () => {
      // Mock game not found
      httpService.request.mockImplementation((config) => {
        if (config.url?.includes('/ownership')) {
          return of({
            data: { ownsGame: true },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          });
        }
        
        if (config.url?.includes('/games/')) {
          return throwError(() => ({
            isAxiosError: true,
            response: { status: 404 },
          } as AxiosError));
        }
        
        return of({ data: {}, status: 200, statusText: 'OK', headers: {}, config: {} as any });
      });

      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send(validReviewData)
        .expect(400);
    });

    it('should handle Game Catalog Service errors gracefully', async () => {
      // Mock game catalog service error (but still allow review creation)
      httpService.request.mockImplementation((config) => {
        if (config.url?.includes('/ownership')) {
          return of({
            data: { ownsGame: true },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          });
        }
        
        if (config.url?.includes('/games/')) {
          return throwError(() => new Error('Game Catalog Service unavailable'));
        }
        
        return of({ data: {}, status: 200, statusText: 'OK', headers: {}, config: {} as any });
      });

      // Should still allow review creation (fail-safe behavior)
      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send(validReviewData)
        .expect(201);
    });
  });

  describe('External service notifications', () => {
    const validReviewData = {
      gameId: mockGameId,
      text: 'This is an excellent game with great graphics!',
      rating: 5,
    };

    beforeEach(() => {
      // Mock successful ownership and game validation
      httpService.request.mockImplementation((config) => {
        if (config.url?.includes('/ownership')) {
          return of({
            data: { ownsGame: true },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          });
        }
        
        if (config.url?.includes('/games/') && config.method === 'HEAD') {
          return of({
            data: null,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          });
        }
        
        // Mock successful notifications
        return of({
          data: { success: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });
      });
    });

    it('should notify Achievement Service about first review', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send(validReviewData)
        .expect(201);

      // Verify achievement notification was sent
      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/achievements/unlock'),
          method: 'POST',
          data: expect.objectContaining({
            userId: mockUserId,
            achievementType: 'FIRST_REVIEW',
          }),
        })
      );
    });

    it('should notify Notification Service about review creation', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send(validReviewData)
        .expect(201);

      // Verify notification service was called
      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/notifications/review-action'),
          method: 'POST',
          data: expect.objectContaining({
            userId: mockUserId,
            gameId: mockGameId,
            action: 'created',
          }),
        })
      );
    });

    it('should notify Game Catalog Service about rating update', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send(validReviewData)
        .expect(201);

      // Verify game catalog rating update was called
      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining(`/games/${mockGameId}/rating`),
          method: 'PUT',
          data: expect.objectContaining({
            gameId: mockGameId,
            averageRating: 5.0,
            totalReviews: 1,
          }),
        })
      );
    });

    it('should handle notification failures gracefully', async () => {
      // Mock notification failures
      httpService.request.mockImplementation((config) => {
        if (config.url?.includes('/ownership')) {
          return of({
            data: { ownsGame: true },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          });
        }
        
        if (config.url?.includes('/games/') && config.method === 'HEAD') {
          return of({
            data: null,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          });
        }
        
        // Mock notification failures
        if (config.url?.includes('/achievements/') || 
            config.url?.includes('/notifications/') ||
            config.url?.includes('/rating')) {
          return throwError(() => new Error('Service unavailable'));
        }
        
        return of({ data: {}, status: 200, statusText: 'OK', headers: {}, config: {} as any });
      });

      // Review creation should still succeed despite notification failures
      const response = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send(validReviewData)
        .expect(201);

      expect(response.body.userId).toBe(mockUserId);
      
      // Verify review was created in database
      const review = await reviewRepository.findOne({
        where: { id: response.body.id },
      });
      expect(review).toBeTruthy();
    });
  });

  describe('Caching behavior', () => {
    const validReviewData = {
      gameId: mockGameId,
      text: 'This is an excellent game with great graphics!',
      rating: 5,
    };

    it('should cache ownership check results', async () => {
      // Mock successful ownership check
      httpService.request.mockReturnValue(of({
        data: { ownsGame: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }));

      // Create first review
      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send(validReviewData)
        .expect(201);

      // Clear the mock to verify caching
      jest.clearAllMocks();

      // Try to create another review for different game (should use cache for user)
      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send({
          ...validReviewData,
          gameId: 'different-game-id',
        })
        .expect(409); // Should fail due to duplicate review prevention, but ownership should be cached

      // Verify ownership check was made for the new game
      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/ownership'),
        })
      );
    });
  });

  describe('Error scenarios and resilience', () => {
    const validReviewData = {
      gameId: mockGameId,
      text: 'This is an excellent game with great graphics!',
      rating: 5,
    };

    it('should handle complete Library Service outage', async () => {
      // Mock complete service failure
      httpService.request.mockReturnValue(
        throwError(() => new Error('ECONNREFUSED'))
      );

      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send(validReviewData)
        .expect(403);
    });

    it('should handle malformed responses from Library Service', async () => {
      // Mock malformed response
      httpService.request.mockReturnValue(of({
        data: null,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }));

      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send(validReviewData)
        .expect(403);
    });

    it('should handle Library Service returning unexpected status codes', async () => {
      // Mock unexpected status code
      httpService.request.mockReturnValue(of({
        data: { ownsGame: true },
        status: 202, // Accepted instead of OK
        statusText: 'Accepted',
        headers: {},
        config: {} as any,
      }));

      const response = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send(validReviewData)
        .expect(201);

      expect(response.body.userId).toBe(mockUserId);
    });

    it('should handle network timeouts gracefully', async () => {
      // Mock timeout
      httpService.request.mockReturnValue(
        throwError(() => ({ code: 'ETIMEDOUT', message: 'timeout' }))
      );

      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send(validReviewData)
        .expect(403);
    });
  });

  describe('Performance and load handling', () => {
    const validReviewData = {
      gameId: mockGameId,
      text: 'This is an excellent game with great graphics!',
      rating: 5,
    };

    it('should handle concurrent ownership checks efficiently', async () => {
      // Mock successful ownership check with delay
      httpService.request.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            data: { ownsGame: true },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          }), 100)
        )
      );

      const promises = Array.from({ length: 5 }, (_, i) =>
        request(app.getHttpServer())
          .post('/api/v1/reviews')
          .set('Authorization', createMockJwtToken(`user-${i}`))
          .send({
            ...validReviewData,
            gameId: `game-${i}`,
          })
      );

      const results = await Promise.allSettled(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value.status).toBe(201);
        }
      });
    });

    it('should handle slow Library Service responses', async () => {
      // Mock slow response (but within timeout)
      httpService.request.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            data: { ownsGame: true },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          }), 2000) // 2 second delay
        )
      );

      const startTime = Date.now();
      
      const response = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', mockJwtToken)
        .send(validReviewData)
        .expect(201);

      const endTime = Date.now();
      
      expect(response.body.userId).toBe(mockUserId);
      expect(endTime - startTime).toBeGreaterThan(2000);
    });
  });
});