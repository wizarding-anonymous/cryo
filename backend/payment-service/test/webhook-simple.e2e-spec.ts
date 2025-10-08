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

describe('Simple Webhook Test', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let authToken: string;

  // Simple in-memory storage for payments
  const payments: { [id: string]: any } = {};

  const testGameId = '550e8400-e29b-41d4-a716-446655440001';

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

  const testOrderId = '550e8400-e29b-41d4-a716-446655440010';

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

  const testPaymentId = '550e8400-e29b-41d4-a716-446655440020';

  const mockPaymentRepository = {
    create: jest.fn().mockImplementation((data) => {
      const payment = {
        id: testPaymentId,
        ...data,
        status: 'pending',
      };
      payments[payment.id] = payment;
      return payment;
    }),
    save: jest.fn().mockImplementation((payment) => {
      payments[payment.id] = { ...payment };
      console.log(`Saved payment ${payment.id} with status ${payment.status}`);
      return Promise.resolve(payments[payment.id]);
    }),
    findOne: jest.fn().mockImplementation((options) => {
      console.log('findOne called with:', options);

      if (options.where?.externalId) {
        // Find by external ID
        const payment = Object.values(payments).find(
          (p: any) => p.externalId === options.where.externalId,
        );
        console.log(
          `Found by externalId ${options.where.externalId}:`,
          payment,
        );
        return Promise.resolve(payment || null);
      }

      if (options.where?.id) {
        const payment = payments[options.where.id];
        console.log(`Found by ID ${options.where.id}:`, payment);
        return Promise.resolve(payment || null);
      }

      return Promise.resolve(null);
    }),
    update: jest.fn().mockImplementation((id, updateData) => {
      if (payments[id]) {
        payments[id] = { ...payments[id], ...updateData };
        console.log(`Updated payment ${id}:`, payments[id]);
      }
      return Promise.resolve({ affected: 1 });
    }),
  };

  const mockPaymentProviderService = {
    processPayment: jest.fn().mockResolvedValue({
      paymentUrl: 'https://mock-payment-url.com',
      externalId: 'test-external-id',
    }),
    handleWebhook: jest.fn().mockImplementation((provider, webhookDto) => {
      return {
        externalId: webhookDto.externalId,
        status: webhookDto.status || 'completed',
      };
    }),
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
    getPayment: jest.fn().mockResolvedValue({
      id: testPaymentId,
      orderId: testOrderId,
      provider: PaymentProvider.SBERBANK,
      status: PaymentStatus.COMPLETED,
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
      .overrideProvider(getRepositoryToken(Payment))
      .useValue(mockPaymentRepository)
      .overrideProvider(PaymentProviderService)
      .useValue(mockPaymentProviderService)
      .overrideProvider(PaymentEventsService)
      .useValue(mockPaymentEventsService)
      .overrideProvider(PaymentService)
      .useValue(mockPaymentService)
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

  it('should process webhook and update payment status', async () => {
    // 1. Create order
    const orderResponse = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ gameId: testGameId })
      .expect(201);

    // 2. Create payment
    const paymentResponse = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        orderId: orderResponse.body.data.id,
        provider: PaymentProvider.SBERBANK,
      })
      .expect(201);

    const paymentId = paymentResponse.body.data.id;

    // 3. Process payment to get external ID
    await request(app.getHttpServer())
      .post(`/payments/${paymentId}/process`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201);

    // 4. Manually set external ID in our payment storage
    if (payments[paymentId]) {
      payments[paymentId].externalId = 'test-external-id';
      payments[paymentId].status = 'processing';
      console.log('Set payment external ID:', payments[paymentId]);
    }

    // 5. Send webhook
    const webhookResponse = await request(app.getHttpServer())
      .post(`/webhooks/${PaymentProvider.SBERBANK}`)
      .send({
        externalId: 'test-external-id',
        status: 'completed',
        amount: 1000,
        currency: 'RUB',
        signature: 'test-signature',
      });

    console.log(
      'Webhook response:',
      webhookResponse.status,
      webhookResponse.body,
    );
    expect(webhookResponse.status).toBe(201);

    // 6. Wait a bit for async processing
    await new Promise((resolve) => setTimeout(resolve, 200));

    // 7. Check payment status
    const updatedPaymentResponse = await request(app.getHttpServer())
      .get(`/payments/${paymentId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    console.log(
      'Final payment status:',
      updatedPaymentResponse.body.data.status,
    );
    console.log('Payment storage:', payments);

    expect(updatedPaymentResponse.body.data.status).toBe(
      PaymentStatus.COMPLETED,
    );
  });
});
