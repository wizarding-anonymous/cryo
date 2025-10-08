import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { IsolatedTestAppModule } from './isolated-test-app.module';
import { JwtService } from '@nestjs/jwt';
import { PaymentProvider } from '../src/common/enums/payment-provider.enum';
import { PaymentStatus } from '../src/common/enums/payment-status.enum';
import { GameCatalogIntegrationService } from '../src/integrations/game-catalog/game-catalog.service';
import { LibraryIntegrationService } from '../src/integrations/library/library.service';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { OrderService } from '../src/modules/order/order.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Payment } from '../src/modules/payment/entities/payment.entity';
import { PaymentProviderService } from '../src/modules/payment/payment-provider.service';
import { PaymentEventsService } from '../src/modules/payment/payment-events.service';
import { PaymentService } from '../src/modules/payment/payment.service';

describe('Payment Providers Simple E2E Tests', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let authToken: string;

  const testGameId = '550e8400-e29b-41d4-a716-446655440001';
  const testOrderId = '550e8400-e29b-41d4-a716-446655440010';
  const testPaymentId = '550e8400-e29b-41d4-a716-446655440020';

  // Простые моки по образцу working тестов
  const mockGameCatalogService = {
    getGameInfo: jest.fn().mockResolvedValue({
      id: testGameId,
      name: 'Test Game',
      price: 1500,
      available: true,
    }),
    getGamePurchaseInfo: jest.fn().mockResolvedValue({
      id: testGameId,
      title: 'Test Game',
      price: 1500,
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
      amount: '1500.00',
      currency: 'RUB',
      status: 'pending',
    }),
    getOrder: jest.fn().mockResolvedValue({
      id: testOrderId,
      userId: 'test-user',
      gameId: testGameId,
      amount: '1500.00',
      currency: 'RUB',
      status: 'pending',
    }),
    updateOrderStatus: jest.fn().mockResolvedValue({}),
    validateOrderOwnership: jest.fn().mockResolvedValue({
      id: testOrderId,
      userId: 'test-user',
      gameId: testGameId,
      amount: '1500.00',
      currency: 'RUB',
      status: 'pending',
    }),
  };

  const mockPaymentService = {
    createPayment: jest.fn().mockResolvedValue({
      id: testPaymentId,
      orderId: testOrderId,
      provider: PaymentProvider.SBERBANK,
      status: 'pending',
      amount: 1500,
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
        amount: 1500,
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
      amount: 1500,
    }),
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

  const mockPaymentRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
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
      .overrideProvider(PaymentService)
      .useValue(mockPaymentService)
      .overrideProvider(PaymentProviderService)
      .useValue(mockPaymentProviderService)
      .overrideProvider(PaymentEventsService)
      .useValue(mockPaymentEventsService)
      .overrideProvider(getRepositoryToken(Payment))
      .useValue(mockPaymentRepository)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    authToken = jwtService.sign({
      sub: 'test-user',
      username: 'test-user',
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Sberbank Payment Provider', () => {
    it('should create an order', async () => {
      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ gameId: testGameId })
        .expect(201);

      expect(response.body.data.id).toBeDefined();
    });

    it('should create a Sberbank payment', async () => {
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

    it('should process Sberbank payment', async () => {
      const response = await request(app.getHttpServer())
        .post(`/payments/${testPaymentId}/process`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.status).toBe(201);
    });

    it('should handle Sberbank webhook', async () => {
      const response = await request(app.getHttpServer())
        .post(`/webhooks/${PaymentProvider.SBERBANK}`)
        .send({
          externalId: 'test-external-id',
          status: 'completed',
          amount: 1500,
          currency: 'RUB',
          signature: 'test-signature',
        })
        .expect(201);

      expect(response.body.data.status).toBe('received');
    });

    it('should get payment status', async () => {
      const response = await request(app.getHttpServer())
        .get(`/payments/${testPaymentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.status).toBe(PaymentStatus.COMPLETED);
    });
  });

  describe('YMoney Payment Provider', () => {
    it('should create a YMoney payment', async () => {
      const response = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: testOrderId,
          provider: PaymentProvider.YANDEX,
        })
        .expect(201);

      expect(response.body.data.id).toBeDefined();
    });

    it('should handle YMoney webhook', async () => {
      const response = await request(app.getHttpServer())
        .post(`/webhooks/${PaymentProvider.YANDEX}`)
        .send({
          externalId: 'test-external-id-ymoney',
          status: 'success',
          amount: 1500,
          currency: 'RUB',
          signature: 'test-signature-ymoney',
        })
        .expect(201);

      expect(response.body.data.status).toBe('received');
    });
  });

  describe('T-Bank Payment Provider', () => {
    it('should create a T-Bank payment', async () => {
      const response = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: testOrderId,
          provider: PaymentProvider.TBANK,
        })
        .expect(201);

      expect(response.body.data.id).toBeDefined();
    });

    it('should handle T-Bank webhook', async () => {
      const response = await request(app.getHttpServer())
        .post(`/webhooks/${PaymentProvider.TBANK}`)
        .send({
          externalId: 'test-external-id-tbank',
          status: 'CONFIRMED',
          amount: 1500,
          currency: 'RUB',
          signature: 'test-signature-tbank',
        })
        .expect(201);

      expect(response.body.data.status).toBe('received');
    });
  });

  describe('Payment Failure Scenarios', () => {
    it('should handle failed payment webhook', async () => {
      const response = await request(app.getHttpServer())
        .post(`/webhooks/${PaymentProvider.SBERBANK}`)
        .send({
          externalId: 'test-external-id-failed',
          status: 'failed',
          amount: 1500,
          currency: 'RUB',
          signature: 'test-signature-failed',
        })
        .expect(201);

      expect(response.body.data.status).toBe('received');
    });

    it('should handle refused payment webhook', async () => {
      const response = await request(app.getHttpServer())
        .post(`/webhooks/${PaymentProvider.YANDEX}`)
        .send({
          externalId: 'test-external-id-refused',
          status: 'refused',
          amount: 1500,
          currency: 'RUB',
          signature: 'test-signature-refused',
        })
        .expect(201);

      expect(response.body.data.status).toBe('received');
    });
  });
});
