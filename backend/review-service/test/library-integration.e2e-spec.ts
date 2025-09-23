import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosError } from 'axios';

import { AppModule } from '../src/app.module';
import { OwnershipService } from '../src/services/ownership.service';
import { HttpExceptionFilter } from '../src/filters';
import { validationConfig } from '../src/config/validation.config';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { describe } from 'node:test';

describe('Library Service Integration (e2e)', () => {
  let app: INestApplication;
  let httpService: jest.Mocked<HttpService>;
  let ownershipService: OwnershipService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Apply same configuration as main app
    app.useGlobalPipes(new ValidationPipe(validationConfig));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.setGlobalPrefix('api/v1');

    await app.init();

    httpService = moduleFixture.get<HttpService>(HttpService) as jest.Mocked<HttpService>;
    ownershipService = moduleFixture.get<OwnershipService>(OwnershipService);

    // Set up environment variables
    process.env.LIBRARY_SERVICE_URL = 'http://library-service:3001';
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Game ownership verification', () => {
    it('should successfully verify game ownership', async () => {
      // Mock successful ownership check
      jest.spyOn(httpService, 'get').mockReturnValue(
        of({
          data: { ownsGame: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        })
      );

      const createReviewDto = {
        gameId: 'owned-game-123',
        text: 'Great game that I own!',
        rating: 5,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', 'Bearer valid-token')
        .send(createReviewDto)
        .expect(201);

      expect(response.body.gameId).toBe('owned-game-123');
      expect(httpService.get).toHaveBeenCalledWith(
        'http://library-service:3001/library/user-123/games/owned-game-123/ownership',
        expect.objectContaining({
          timeout: 5000,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should reject review creation when user does not own game', async () => {
      // Mock ownership check returning false
      jest.spyOn(httpService, 'get').mockReturnValue(
        of({
          data: { ownsGame: false },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        })
      );

      const createReviewDto = {
        gameId: 'unowned-game-456',
        text: 'Trying to review a game I do not own',
        rating: 3,
      };

      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', 'Bearer valid-token')
        .send(createReviewDto)
        .expect(403);

      expect(httpService.get).toHaveBeenCalledWith(
        'http://library-service:3001/library/user-123/games/unowned-game-456/ownership',
        expect.objectContaining({
          timeout: 5000,
        })
      );
    });

    it('should handle Library Service 404 errors gracefully', async () => {
      // Mock 404 error (game or user not found)
      const axiosError = {
        isAxiosError: true,
        response: { status: 404, data: { message: 'Game not found' } },
      } as AxiosError;

      jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => axiosError));

      const createReviewDto = {
        gameId: 'nonexistent-game',
        text: 'Review for nonexistent game',
        rating: 4,
      };

      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', 'Bearer valid-token')
        .send(createReviewDto)
        .expect(403);
    });

    it('should handle Library Service timeout errors', async () => {
      // Mock timeout error
      const timeoutError = {
        isAxiosError: true,
        code: 'ECONNABORTED',
        message: 'timeout of 5000ms exceeded',
      } as AxiosError;

      jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => timeoutError));

      const createReviewDto = {
        gameId: 'timeout-game',
        text: 'Review during timeout',
        rating: 2,
      };

      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', 'Bearer valid-token')
        .send(createReviewDto)
        .expect(403);
    });

    it('should retry on Library Service server errors', async () => {
      // Mock server error that should trigger retry
      const serverError = {
        isAxiosError: true,
        response: { status: 500, data: { message: 'Internal server error' } },
      } as AxiosError;

      jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => serverError));

      // Mock the delay method to speed up test
      jest.spyOn(ownershipService as any, 'delay').mockResolvedValue(undefined);

      const createReviewDto = {
        gameId: 'server-error-game',
        text: 'Review during server error',
        rating: 1,
      };

      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', 'Bearer valid-token')
        .send(createReviewDto)
        .expect(403);

      // Should have retried 3 times (MAX_RETRIES)
      expect(httpService.get).toHaveBeenCalledTimes(3);
    });

    it('should succeed after retry on intermittent failures', async () => {
      let callCount = 0;
      jest.spyOn(httpService, 'get').mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          // First two calls fail
          const serverError = {
            isAxiosError: true,
            response: { status: 503, data: { message: 'Service unavailable' } },
          } as AxiosError;
          return throwError(() => serverError);
        } else {
          // Third call succeeds
          return of({
            data: { ownsGame: true },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          });
        }
      });

      // Mock the delay method to speed up test
      jest.spyOn(ownershipService as any, 'delay').mockResolvedValue(undefined);

      const createReviewDto = {
        gameId: 'intermittent-failure-game',
        text: 'Review after intermittent failures',
        rating: 4,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', 'Bearer valid-token')
        .send(createReviewDto)
        .expect(201);

      expect(response.body.gameId).toBe('intermittent-failure-game');
      expect(httpService.get).toHaveBeenCalledTimes(3);
    });
  });

  describe('User owned games retrieval', () => {
    it('should retrieve user owned games successfully', async () => {
      const mockOwnedGames = {
        data: {
          games: [
            { gameId: 'game-1', title: 'Game One', purchaseDate: '2024-01-01' },
            { gameId: 'game-2', title: 'Game Two', purchaseDate: '2024-01-15' },
            { gameId: 'game-3', title: 'Game Three', purchaseDate: '2024-02-01' },
          ],
        },
      };

      jest.spyOn(httpService, 'get').mockReturnValue(
        of({
          ...mockOwnedGames,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        })
      );

      const ownedGames = await ownershipService.getUserOwnedGames('user-123');

      expect(ownedGames).toEqual(['game-1', 'game-2', 'game-3']);
      expect(httpService.get).toHaveBeenCalledWith(
        'http://library-service:3001/library/user-123/games',
        expect.objectContaining({
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should handle empty owned games list', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(
        of({
          data: { games: [] },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        })
      );

      const ownedGames = await ownershipService.getUserOwnedGames('user-with-no-games');

      expect(ownedGames).toEqual([]);
    });

    it('should handle malformed response from Library Service', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(
        of({
          data: null,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        })
      );

      const ownedGames = await ownershipService.getUserOwnedGames('user-malformed');

      expect(ownedGames).toEqual([]);
    });

    it('should handle Library Service errors when retrieving owned games', async () => {
      const networkError = new Error('Network error');
      jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => networkError));

      const ownedGames = await ownershipService.getUserOwnedGames('user-error');

      expect(ownedGames).toEqual([]);
    });
  });

  describe('Caching behavior', () => {
    it('should cache ownership results', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(
        of({
          data: { ownsGame: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        })
      );

      // First call should hit the service
      const result1 = await ownershipService.checkGameOwnership('user-cache', 'game-cache');
      expect(result1).toBe(true);
      expect(httpService.get).toHaveBeenCalledTimes(1);

      // Second call should use cache (mock won't be called again)
      jest.clearAllMocks();
      const result2 = await ownershipService.checkGameOwnership('user-cache', 'game-cache');
      expect(result2).toBe(true);
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('should invalidate cache when requested', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(
        of({
          data: { ownsGame: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        })
      );

      // First call
      await ownershipService.checkGameOwnership('user-invalidate', 'game-invalidate');
      expect(httpService.get).toHaveBeenCalledTimes(1);

      // Invalidate cache
      await ownershipService.invalidateOwnershipCache('user-invalidate', 'game-invalidate');

      // Second call should hit the service again
      await ownershipService.checkGameOwnership('user-invalidate', 'game-invalidate');
      expect(httpService.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('Integration with review creation flow', () => {
    it('should complete full review creation flow with ownership verification', async () => {
      // Mock successful ownership verification
      jest.spyOn(httpService, 'get').mockReturnValue(
        of({
          data: { ownsGame: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        })
      );

      const createReviewDto = {
        gameId: 'integration-test-game',
        text: 'This is a comprehensive integration test review with proper ownership verification.',
        rating: 5,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', 'Bearer valid-token')
        .send(createReviewDto)
        .expect(201);

      expect(response.body).toMatchObject({
        gameId: 'integration-test-game',
        text: createReviewDto.text,
        rating: 5,
        userId: expect.any(String),
        id: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      // Verify ownership was checked
      expect(httpService.get).toHaveBeenCalledWith(
        expect.stringContaining('/ownership'),
        expect.any(Object)
      );
    });

    it('should prevent review creation for unowned games', async () => {
      // Mock ownership verification failure
      jest.spyOn(httpService, 'get').mockReturnValue(
        of({
          data: { ownsGame: false },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        })
      );

      const createReviewDto = {
        gameId: 'unowned-integration-game',
        text: 'Attempting to review a game I do not own.',
        rating: 3,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', 'Bearer valid-token')
        .send(createReviewDto)
        .expect(403);

      expect(response.body.error).toMatchObject({
        code: expect.any(String),
        message: expect.stringContaining('own'),
      });
    });
  });

  describe('Error handling and resilience', () => {
    it('should handle Library Service being completely unavailable', async () => {
      // Mock connection refused error
      const connectionError = {
        isAxiosError: true,
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED 127.0.0.1:3001',
      } as AxiosError;

      jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => connectionError));

      const createReviewDto = {
        gameId: 'unavailable-service-game',
        text: 'Review when service is unavailable',
        rating: 2,
      };

      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', 'Bearer valid-token')
        .send(createReviewDto)
        .expect(403);
    });

    it('should handle Library Service returning invalid JSON', async () => {
      // Mock invalid JSON response
      jest.spyOn(httpService, 'get').mockReturnValue(
        of({
          data: 'invalid json response',
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        })
      );

      const createReviewDto = {
        gameId: 'invalid-json-game',
        text: 'Review with invalid JSON response',
        rating: 1,
      };

      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', 'Bearer valid-token')
        .send(createReviewDto)
        .expect(403);
    });
  });
});