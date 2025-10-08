import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { PaymentProvider } from '../src/common/enums/payment-provider.enum';
import { IsolatedTestAppModule } from './isolated-test-app.module';
import { GameCatalogIntegrationService } from '../src/integrations/game-catalog/game-catalog.service';
import { LibraryIntegrationService } from '../src/integrations/library/library.service';
import { OrderService } from '../src/modules/order/order.service';
import { PaymentService } from '../src/modules/payment/payment.service';
import { PaymentProviderService } from '../src/modules/payment/payment-provider.service';
import { PaymentEventsService } from '../src/modules/payment/payment-events.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Payment } from '../src/modules/payment/entities/payment.entity';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

describe('Simple Payment E2E Tests', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let authToken: string;

  const testGameId = '550e8400-e29b-41d4-a716-446655440001';
  const testOrderId = '550e8400-e29b-41d4-a716-446655440010';
  const testPaymentId = '550e8400-e29b-41d4-a716-446655440020';

  // Simple mocks
  const mockGameCatalogService = {
    getGameInfo: jest.fn().mockResolvedValue({
      id: testGameId,
      name: 'Test Game',
      price: 1000,
      available: true,
    }),
    getGamePurchaseInfo: jest.fn().mockResolvedValue({
      id: testGameId,
      title: 'Test Game',
      price: 1000,
      currency: 'RUB',
      available: true,
    }),
    checkHealth: jest.fn().mockResolvedValue({ status: 'up' }),
  };

  const mockLibraryService = {
    addGameToLibrary: jest.fn().mockResolvedValue({ success: true }),
    checkHealth: jest.fn().mockResolvedValue({ status: 'up' }),
  };

  const mockOrderService = {
    createOrder: jest.fn().mockResolvedValue({
      id: testOrderId,
      userId: 'test-user',
      gameId: testGameId,
      amount: '1000.00',
      currency: 'RUB',
      status: 'pending',
    }),
    getOrder: jest.fn().mockResolvedValue({
      id: testOrderId,
      userId: 'test-user',
      gameId: testGameId,
      amount: '1000.00',
      currency: 'RUB',
      status: 'pending',
    }),
    updateOrderStatus: jest.fn().mockResolvedValue({}),
    validateOrderOwnership: jest.fn().mockResolvedValue({
      id: testOrderId,
      userId: 'test-user',
      gameId: testGameId,
      amount: '1000.00',
      currency: 'RUB',
      status: 'pending',
    }),
  };

  const mockPaymentRepository = {
    create: jest.fn().mockImplementation((data) => ({
      id: testPaymentId,
      ...data,
      status: 'pending',
    })),
    save: jest.fn().mockImplementation((payment) =>
      Promise.resolve({
        ...payment,
        id: payment.id || testPaymentId,
        status: payment.status || 'completed',
        completedAt: payment.status === 'completed' ? new Date() : undefined,
      }),
    ),
    findOne: jest.fn().mockImplementation((options) => {
      if (options.where?.externalId) {
        return Promise.resolve({
          id: testPaymentId,
          status: 'processing',
          provider: PaymentProvider.SBERBANK,
          orderId: testOrderId,
          externalId: options.where.externalId,
          amount: 1000,
        });
      }
      return Promise.resolve({
        id: options.where?.id || testPaymentId,
        status: 'pending', // Changed to 'pending' for processing
        provider: PaymentProvider.SBERBANK,
        orderId: testOrderId,
        amount: 1000,
      });
    }),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const mockPaymentProviderService = {
    processPayment: jest.fn().mockResolvedValue({
      paymentUrl: 'https://mock-payment-url.com',
      externalId: 'test-external-id',
    }),
    handleWebhook: jest.fn().mockImplementation((provider, webhookDto) => ({
      externalId: webhookDto.externalId,
      status: webhookDto.status || 'completed',
    })),
  };

  const mockPaymentEventsService = {
    publishPaymentCompleted: jest.fn().mockResolvedValue(true),
  };

  const mockPaymentService = {
    createPayment: jest.fn().mockResolvedValue({
      id: testPaymentId,
      orderId: testOrderId,
      provider: PaymentProvider.SBERBANK,
      status: 'pending',
      amount: 1000,
    }),
    processPayment: jest.fn().mockResolvedValue({
      paymentUrl: 'https://mock-payment-url.com',
      externalId: 'test-external-id',
    }),
    findByExternalId: jest.fn().mockImplementation((externalId) => {
      return Promise.resolve({
        id: testPaymentId,
        orderId: testOrderId,
        provider: PaymentProvider.SBERBANK,
        status: 'processing',
        amount: 1000,
        externalId: externalId,
      });
    }),
    confirmPayment: jest.fn().mockResolvedValue({
      id: testPaymentId,
      status: 'completed',
    }),
    cancelPayment: jest.fn().mockResolvedValue({
      id: testPaymentId,
      status: 'cancelled',
    }),
    getPayment: jest.fn().mockResolvedValue({
      id: testPaymentId,
      orderId: testOrderId,
      provider: PaymentProvider.SBERBANK,
      status: 'completed',
      amount: 1000,
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [IsolatedTestAppModule],
    })
      .overrideProvider(GameCatalogIntegrationService)
      .useValue(mockGameCatalogService)
      .overrideProvider(LibraryIntegrationService)
      .useValue(mockLibraryService)
      .overrideProvider(OrderService)
      .useValue(mockOrderService)
      .overrideProvider(PaymentProviderService)
      .useValue(mockPaymentProviderService)
      .overrideProvider(PaymentEventsService)
      .useValue(mockPaymentEventsService)
      .overrideProvider(PaymentService)
      .useValue(mockPaymentService)
      .overrideProvider(getRepositoryToken(Payment))
      .useValue(mockPaymentRepository)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    authToken = jwtService.sign(
      {
        sub: 'test-user',
        username: 'test-user',
      },
      {
        secret:
          'test_jwt_secret_key_here_make_it_long_and_secure_minimum_32_chars',
      },
    );
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should create an order', async () => {
    const response = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ gameId: testGameId })
      .expect(201);

    expect(response.body.data.id).toBeDefined();
  });

  it('should create a payment', async () => {
    const response = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        orderId: testOrderId,
        provider: PaymentProvider.SBERBANK,
      })
      .expect(201);

    expect(response.body.data.id).toBeDefined();
  });

  it('should process payment', async () => {
    const response = await request(app.getHttpServer())
      .post(`/payments/${testPaymentId}/process`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201);

    expect(response.status).toBe(201);
  });

  it('should handle webhook', async () => {
    const response = await request(app.getHttpServer())
      .post(`/webhooks/${PaymentProvider.SBERBANK}`)
      .send({
        externalId: 'test-external-id',
        status: 'completed',
        amount: 1000,
        currency: 'RUB',
        signature: 'test-signature',
      })
      .expect(201);

    expect(response.status).toBe(201);
  });
});
