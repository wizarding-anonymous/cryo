import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { GamePurchaseInfo } from '../src/integrations/game-catalog/dto/game-purchase-info.dto';

describe('Game Catalog Integration (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let httpService: HttpService;
  let authToken: string;

  const mockGameInfo: GamePurchaseInfo = {
    id: 'test-game-123',
    title: 'Test Game for E2E',
    price: 1500,
    currency: 'RUB',
    available: true,
  };

  const unavailableGameInfo: GamePurchaseInfo = {
    id: 'unavailable-game-456',
    title: 'Unavailable Game',
    price: 2000,
    currency: 'RUB',
    available: false,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    httpService = moduleFixture.get<HttpService>(HttpService);
    authToken = jwtService.sign({ sub: 'test-user-id', username: 'testuser' });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Order Creation with Game Validation', () => {
    it('should create order successfully when game exists and is available', async () => {
      // Mock successful game catalog response
      jest.spyOn(httpService, 'get').mockReturnValue(
        of({
          data: mockGameInfo,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        }),
      );

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          gameId: 'test-game-123',
        })
        .expect(201);

      expect(response.body.data).toMatchObject({
        gameId: 'test-game-123',
        gameName: 'Test Game for E2E',
        amount: 1500,
        currency: 'RUB',
        status: 'pending',
      });

      // Verify the correct API call was made
      expect(httpService.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/internal/games/test-game-123/purchase-info'),
      );
    });

    it('should fail to create order when game does not exist', async () => {
      // Mock game not found response
      jest.spyOn(httpService, 'get').mockReturnValue(
        throwError(() => new Error('Game not found')),
      );

      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          gameId: 'non-existent-game',
        })
        .expect(400)
        .then((response) => {
          expect(response.body.message).toContain('could not be found');
        });
    });

    it('should fail to create order when game is not available', async () => {
      // Mock unavailable game response
      jest.spyOn(httpService, 'get').mockReturnValue(
        of({
          data: unavailableGameInfo,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        }),
      );

      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          gameId: 'unavailable-game-456',
        })
        .expect(400)
        .then((response) => {
          expect(response.body.message).toContain('not available for purchase');
        });
    });

    it('should fail to create order when game catalog service is unavailable', async () => {
      // Mock service unavailable
      jest.spyOn(httpService, 'get').mockReturnValue(
        throwError(() => new Error('Service Unavailable')),
      );

      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          gameId: 'any-game-id',
        })
        .expect(400)
        .then((response) => {
          expect(response.body.message).toContain('could not be found');
        });
    });

    it('should handle timeout from game catalog service', async () => {
      // Mock timeout
      jest.spyOn(httpService, 'get').mockReturnValue(
        throwError(() => new Error('Timeout')),
      );

      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          gameId: 'timeout-game-id',
        })
        .expect(400)
        .then((response) => {
          expect(response.body.message).toContain('could not be found');
        });
    });
  });

  describe('Caching Behavior', () => {
    it('should cache game information after first request', async () => {
      const gameId = 'cached-game-123';
      const gameInfo = {
        ...mockGameInfo,
        id: gameId,
        title: 'Cached Game',
      };

      // Mock first request
      jest.spyOn(httpService, 'get').mockReturnValue(
        of({
          data: gameInfo,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        }),
      );

      // First order creation
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          gameId: gameId,
        })
        .expect(201);

      // Clear the mock to ensure second call uses cache
      jest.clearAllMocks();

      // Second order creation should use cache (no HTTP call)
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          gameId: gameId,
        })
        .expect(201);

      // Verify no HTTP call was made for the second request
      expect(httpService.get).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle malformed response from game catalog service', async () => {
      // Mock malformed response
      jest.spyOn(httpService, 'get').mockReturnValue(
        of({
          data: null,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        }),
      );

      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          gameId: 'malformed-response-game',
        })
        .expect(400)
        .then((response) => {
          expect(response.body.message).toContain('could not be found');
        });
    });

    it('should handle network errors gracefully', async () => {
      // Mock network error
      jest.spyOn(httpService, 'get').mockReturnValue(
        throwError(() => new Error('ECONNREFUSED')),
      );

      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          gameId: 'network-error-game',
        })
        .expect(400)
        .then((response) => {
          expect(response.body.message).toContain('could not be found');
        });
    });

    it('should handle HTTP error responses', async () => {
      // Mock HTTP 500 error
      jest.spyOn(httpService, 'get').mockReturnValue(
        throwError(() => ({
          response: {
            status: 500,
            statusText: 'Internal Server Error',
          },
        })),
      );

      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          gameId: 'server-error-game',
        })
        .expect(400)
        .then((response) => {
          expect(response.body.message).toContain('could not be found');
        });
    });
  });

  describe('Health Check Integration', () => {
    it('should include game catalog service status in health check', async () => {
      // Mock healthy game catalog service
      jest.spyOn(httpService, 'get').mockReturnValue(
        of({
          data: { status: 'ok' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        }),
      );

      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body.details).toHaveProperty('game-catalog-service');
      expect(response.body.details['game-catalog-service'].status).toBe('up');
    });

    it('should report game catalog service as down when unhealthy', async () => {
      // Mock unhealthy game catalog service
      jest.spyOn(httpService, 'get').mockReturnValue(
        throwError(() => new Error('Service Unavailable')),
      );

      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body.details).toHaveProperty('game-catalog-service');
      expect(response.body.details['game-catalog-service'].status).toBe('down');
    });
  });
});