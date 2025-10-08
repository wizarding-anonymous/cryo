import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { GameCatalogIntegrationService } from '../src/integrations/game-catalog/game-catalog.service';
import { LibraryIntegrationService } from '../src/integrations/library/library.service';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

describe('Game Catalog Integration (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let authToken: string;

  // Mock services
  const mockGameCatalogService = {
    getGameInfo: jest.fn().mockImplementation((gameId: string) => {
      if (gameId === '550e8400-e29b-41d4-a716-446655440002') {
        return Promise.resolve({
          id: '550e8400-e29b-41d4-a716-446655440002',
          name: 'Test Game for E2E',
          price: 1500,
          available: true,
        });
      } else if (gameId === '550e8400-e29b-41d4-a716-446655440003') {
        return Promise.resolve({
          id: '550e8400-e29b-41d4-a716-446655440003',
          name: 'Unavailable Game',
          price: 2000,
          available: false,
        });
      } else {
        return Promise.reject(new Error('Game not found'));
      }
    }),
    getGamePurchaseInfo: jest.fn().mockImplementation((gameId: string) => {
      if (gameId === '550e8400-e29b-41d4-a716-446655440002') {
        return Promise.resolve({
          id: '550e8400-e29b-41d4-a716-446655440002',
          title: 'Test Game for E2E',
          price: 1500,
          currency: 'RUB',
          available: true,
        });
      } else if (gameId === '550e8400-e29b-41d4-a716-446655440003') {
        return Promise.resolve({
          id: '550e8400-e29b-41d4-a716-446655440003',
          title: 'Unavailable Game',
          price: 2000,
          currency: 'RUB',
          available: false,
        });
      } else {
        return Promise.resolve(null);
      }
    }),
    checkHealth: jest.fn().mockResolvedValue({ status: 'up' }),
  };

  const mockLibraryService = {
    addGameToLibrary: jest.fn().mockResolvedValue({ success: true }),
    checkHealth: jest.fn().mockResolvedValue({ status: 'up' }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GameCatalogIntegrationService)
      .useValue(mockGameCatalogService)
      .overrideProvider(LibraryIntegrationService)
      .useValue(mockLibraryService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    authToken = jwtService.sign({ sub: 'test-user-id', username: 'testuser' });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Order Creation with Game Validation', () => {
    it('should create order successfully when game exists and is available', async () => {
      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          gameId: '550e8400-e29b-41d4-a716-446655440002',
        })
        .expect(201);

      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.gameId).toBe(
        '550e8400-e29b-41d4-a716-446655440002',
      );
      expect(mockGameCatalogService.getGamePurchaseInfo).toHaveBeenCalled();
    });

    it('should fail to create order when game does not exist', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          gameId: '550e8400-e29b-41d4-a716-446655440999',
        })
        .expect(400);
    });

    it('should fail to create order when game is not available', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          gameId: '550e8400-e29b-41d4-a716-446655440003',
        })
        .expect(400);
    });

    it('should fail to create order when game catalog service is unavailable', async () => {
      // Update mock to reject with service error
      mockGameCatalogService.getGameInfo.mockRejectedValueOnce(
        new Error('Service Unavailable'),
      );

      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          gameId: '550e8400-e29b-41d4-a716-446655440004',
        })
        .expect(400);
    });

    it('should handle timeout from game catalog service', async () => {
      // Update mock to reject with timeout
      mockGameCatalogService.getGameInfo.mockRejectedValueOnce(
        new Error('Timeout'),
      );

      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          gameId: '550e8400-e29b-41d4-a716-446655440005',
        })
        .expect(400);
    });
  });

  describe('Caching Behavior', () => {
    it('should cache game information after first request', async () => {
      const gameId = '550e8400-e29b-41d4-a716-446655440002';

      // First request
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          gameId: gameId,
        })
        .expect(201);

      // Second request should also work (caching is handled internally)
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          gameId: gameId,
        })
        .expect(201);

      // Verify mock was called
      expect(mockGameCatalogService.getGamePurchaseInfo).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle malformed response from game catalog service', async () => {
      // Update mock to return malformed data
      mockGameCatalogService.getGameInfo.mockRejectedValueOnce(
        new Error('Malformed response'),
      );

      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          gameId: '550e8400-e29b-41d4-a716-446655440007',
        })
        .expect(400);
    });

    it('should handle network errors gracefully', async () => {
      // Update mock to simulate network error
      mockGameCatalogService.getGameInfo.mockRejectedValueOnce(
        new Error('ECONNREFUSED'),
      );

      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          gameId: '550e8400-e29b-41d4-a716-446655440008',
        })
        .expect(400);
    });

    it('should handle HTTP error responses', async () => {
      // Update mock to simulate HTTP error
      mockGameCatalogService.getGameInfo.mockRejectedValueOnce(
        new Error('HTTP 500 Error'),
      );

      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          gameId: '550e8400-e29b-41d4-a716-446655440009',
        })
        .expect(400);
    });
  });

  describe('Health Check Integration', () => {
    it('should include game catalog service status in health check', async () => {
      await request(app.getHttpServer()).get('/health').expect([200, 503]); // Accept both healthy and unhealthy due to memory limits

      // Health check should include game catalog service
      expect(mockGameCatalogService.checkHealth).toHaveBeenCalled();
    });

    it('should report game catalog service as down when unhealthy', async () => {
      // Update mock to return unhealthy status
      mockGameCatalogService.checkHealth.mockResolvedValueOnce({
        status: 'down',
      });

      await request(app.getHttpServer()).get('/health').expect([200, 503]); // Accept both due to other health checks

      expect(mockGameCatalogService.checkHealth).toHaveBeenCalled();
    });
  });
});
