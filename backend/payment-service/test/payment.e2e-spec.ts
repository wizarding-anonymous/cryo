import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { PaymentProvider } from '../src/common/enums/payment-provider.enum';
import { OrderStatus } from '../src/common/enums/order-status.enum';
import { PaymentStatus } from '../src/common/enums/payment-status.enum';
import { GameCatalogIntegrationService } from '../src/integrations/game-catalog/game-catalog.service';
import { LibraryIntegrationService } from '../src/integrations/library/library.service';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

describe('PaymentController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let authToken: string;

  // Mock services
  const mockGameCatalogService = {
    getGameInfo: jest.fn().mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440010',
      name: 'Test E2E Payment Game',
      price: 999,
      available: true,
    }),
    getGamePurchaseInfo: jest.fn().mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440010',
      title: 'Test E2E Payment Game',
      price: 999,
      currency: 'RUB',
      available: true,
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
    authToken = jwtService.sign({ sub: 'e2e-test-user', username: 'e2e-user' });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  let orderId: string;
  let paymentId: string;

  it('should create an order first', async () => {
    const response = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        gameId: '550e8400-e29b-41d4-a716-446655440010',
      })
      .expect(201);

    orderId = response.body.data.id;
    expect(orderId).toBeDefined();
  });

  it('/payments (POST) -> should create a new payment for the order', async () => {
    const response = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        orderId: orderId,
        provider: PaymentProvider.SBERBANK,
      })
      .expect(201);

    paymentId = response.body.data.id;
    expect(paymentId).toBeDefined();
    expect(response.body.data.status).toEqual(PaymentStatus.PENDING);
  });

  it('/payments/:id/process (POST) -> should process the payment and return a mock URL', async () => {
    const response = await request(app.getHttpServer())
      .post(`/payments/${paymentId}/process`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201);

    expect(response.body.data.paymentUrl).toContain(
      `/mock/sberbank/payment-form/${paymentId}`,
    );
  });

  it('/payments/:id/confirm (POST) -> should confirm the payment', async () => {
    await request(app.getHttpServer())
      .post(`/payments/${paymentId}/confirm`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201);
  });

  it('should verify that payment and order statuses are updated', async () => {
    // Check payment status
    const paymentResponse = await request(app.getHttpServer())
      .get(`/payments/${paymentId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(paymentResponse.body.data.status).toEqual(PaymentStatus.COMPLETED);

    // Check order status
    const orderResponse = await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(orderResponse.body.data.status).toEqual(OrderStatus.PAID);
  });
});
