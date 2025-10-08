import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { GameCatalogIntegrationService } from '../src/integrations/game-catalog/game-catalog.service';
import { LibraryIntegrationService } from '../src/integrations/library/library.service';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

describe('OrderController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let authToken: string;

  // Mock services
  const mockGameCatalogService = {
    getGameInfo: jest.fn().mockImplementation((gameId) => {
      console.log('Mock getGameInfo called with:', gameId);
      return Promise.resolve({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Game',
        price: 500,
        available: true,
      });
    }),
    getGamePurchaseInfo: jest.fn().mockImplementation((gameId) => {
      console.log('Mock getGamePurchaseInfo called with:', gameId);
      return Promise.resolve({
        id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test Game',
        price: 500,
        currency: 'RUB',
        available: true,
      });
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

  let orderId: string;

  it('/orders (POST) -> should create a new order', async () => {
    const response = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        gameId: '550e8400-e29b-41d4-a716-446655440000',
      });

    expect(response.status).toBe(201);
    expect(response.body).toBeDefined();
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.id).toBeDefined();

    orderId = response.body.data.id;
  });

  it('/orders/:id (GET) -> should get a specific order', () => {
    return request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200)
      .then((response) => {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.id).toEqual(orderId);
        expect(response.body.data.amount).toEqual('500.00');
      });
  });

  it('/orders (GET) -> should get a list of orders', () => {
    return request(app.getHttpServer())
      .get('/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200)
      .then((response) => {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.total).toBeGreaterThan(0);
        expect(response.body.data.data).toBeInstanceOf(Array);
      });
  });
});
