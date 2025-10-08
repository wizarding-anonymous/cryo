import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { IsolatedTestAppModule } from './isolated-test-app.module';
import { GameCatalogIntegrationService } from '../src/integrations/game-catalog/game-catalog.service';
import { LibraryIntegrationService } from '../src/integrations/library/library.service';
import { JwtService } from '@nestjs/jwt';
import { GamePurchaseInfo } from '../src/integrations/game-catalog/dto/game-purchase-info.dto';
import { PaymentProvider } from '../src/common/enums/payment-provider.enum';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Payment } from '../src/modules/payment/entities/payment.entity';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { OrderService } from '../src/modules/order/order.service';
import { PaymentProviderService } from '../src/modules/payment/payment-provider.service';
import { PaymentEventsService } from '../src/modules/payment/payment-events.service';

describe('Happy Path (E2E)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const mockGameInfo: GamePurchaseInfo = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    title: 'Test E2E Game',
    price: 1299,
    currency: 'RUB',
    available: true,
  };

  const mockPaymentRepository = {
    create: jest.fn().mockImplementation((data) => {
      const paymentId = 'mock-payment-id-' + Date.now();
      const mockPayment = {
        id: paymentId,
        status: 'pending',
        ...data,
        save: jest.fn().mockResolvedValue({
          id: paymentId,
          status: 'pending',
          ...data,
        }),
      };
      return mockPayment;
    }),
    save: jest.fn().mockResolvedValue({
      id: 'mock-payment-id',
    }),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    findOne: jest.fn().mockImplementation((options) => {
      // For webhook calls (searching by externalId)
      if (options.where && options.where.externalId) {
        return Promise.resolve({
          id: 'mock-payment-id',
          status: 'processing',
          provider: PaymentProvider.SBERBANK,
          orderId: '550e8400-e29b-41d4-a716-446655440010',
          externalId: options.where.externalId,
          amount: 1299,
          save: jest.fn().mockResolvedValue({
            id: 'mock-payment-id',
            status: 'completed',
            provider: PaymentProvider.SBERBANK,
            orderId: '550e8400-e29b-41d4-a716-446655440010',
          }),
        });
      }
      // For regular payment operations (searching by id)
      return Promise.resolve({
        id: options.where?.id || 'mock-payment-id',
        status: 'pending', // Start with pending status
        provider: PaymentProvider.SBERBANK,
        orderId: '550e8400-e29b-41d4-a716-446655440010',
        amount: 1299,
        save: jest.fn().mockResolvedValue({
          id: options.where?.id || 'mock-payment-id',
          status: 'processing',
          provider: PaymentProvider.SBERBANK,
          orderId: '550e8400-e29b-41d4-a716-446655440010',
        }),
      });
    }),
    findOneBy: jest.fn().mockImplementation(() => {
      // Return payment based on search criteria
      return Promise.resolve({
        id: 'mock-payment-id',
        status: 'processing',
        provider: PaymentProvider.SBERBANK,
        orderId: 'mock-order-id',
        externalId: 'mock-external-id-from-webhook',
        amount: 1299,
        save: jest.fn().mockResolvedValue({
          id: 'mock-payment-id',
          status: 'completed',
          provider: PaymentProvider.SBERBANK,
          orderId: 'mock-order-id',
        }),
      });
    }),
  };

  // Mock services для изолированного тестирования (без внешних микросервисов)
  const mockGameCatalogService = {
    getGameInfo: jest.fn().mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Test E2E Game',
      price: 1299,
      available: true,
    }),
    getGamePurchaseInfo: jest.fn().mockResolvedValue(mockGameInfo),
    checkHealth: jest.fn().mockResolvedValue({ status: 'up' }), // Эмулируем что сервис доступен
  };

  const mockLibraryService = {
    addGameToLibrary: jest.fn().mockResolvedValue({ success: true }), // Эмулируем успешное добавление в библиотеку
    checkHealth: jest.fn().mockResolvedValue({ status: 'up' }), // Эмулируем что сервис доступен
  };

  const mockOrderService = {
    createOrder: jest.fn().mockImplementation((createOrderDto) => {
      return Promise.resolve({
        id: '550e8400-e29b-41d4-a716-446655440010',
        userId: createOrderDto.userId,
        gameId: createOrderDto.gameId,
        amount: '1299.00',
        currency: 'RUB',
        status: 'pending',
      });
    }),
    getOrder: jest.fn().mockImplementation((orderId) => {
      return Promise.resolve({
        id: orderId || '550e8400-e29b-41d4-a716-446655440010',
        userId: 'e2e-user-id',
        gameId: mockGameInfo.id,
        amount: '1299.00',
        currency: 'RUB',
        status: 'pending',
      });
    }),
    updateOrderStatus: jest.fn().mockResolvedValue({}),
    getOrders: jest.fn().mockResolvedValue({
      data: [],
      total: 0,
    }),
    validateOrderOwnership: jest.fn().mockImplementation((orderId, userId) => {
      return Promise.resolve({
        id: orderId || '550e8400-e29b-41d4-a716-446655440010',
        userId: userId,
        gameId: mockGameInfo.id,
        amount: '1299.00',
        currency: 'RUB',
        status: 'pending',
      });
    }),
  };

  const mockPaymentProviderService = {
    processPayment: jest.fn().mockResolvedValue({
      paymentUrl: 'https://mock-payment-url.com',
      externalId: 'mock-external-id-from-webhook',
    }),
    handleWebhook: jest.fn().mockImplementation((provider, webhookDto) => {
      return {
        externalId: webhookDto.externalId || 'mock-external-id-from-webhook',
        status: webhookDto.status || 'completed',
      };
    }),
  };

  const mockPaymentEventsService = {
    publishPaymentCompleted: jest.fn().mockResolvedValue(true),
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
      .overrideProvider(getRepositoryToken(Payment))
      .useValue(mockPaymentRepository)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should successfully process a full order -> payment -> library flow', async () => {
    // Reset all mocks before test
    jest.clearAllMocks();

    const token = jwtService.sign({ sub: 'e2e-user-id', username: 'e2e-user' });

    // 1. Create an order
    const orderResponse = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ gameId: mockGameInfo.id })
      .expect(201);

    const orderId = orderResponse.body.data.id;
    expect(orderId).toBeDefined();

    // 2. Create a payment for the order
    const paymentResponse = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderId, provider: PaymentProvider.SBERBANK })
      .expect(201);

    const paymentId = paymentResponse.body.data.id;
    expect(paymentId).toBeDefined();

    // 3. Process the payment to get the (mock) URL
    await request(app.getHttpServer())
      .post(`/payments/${paymentId}/process`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    // 4. Simulate a successful webhook callback
    const externalId = 'mock-external-id-from-webhook';

    // Mock the findByExternalId call to return the payment with correct data
    // Override the findOne mock specifically for webhook calls
    mockPaymentRepository.findOne.mockImplementation((options) => {
      // If searching by externalId (webhook call)
      if (options.where && options.where.externalId) {
        return Promise.resolve({
          id: paymentId,
          orderId: orderId,
          provider: PaymentProvider.SBERBANK,
          externalId: options.where.externalId,
          status: 'processing',
          amount: 1299,
        });
      }
      // For regular payment operations (searching by id)
      return Promise.resolve({
        id: options.where?.id || paymentId,
        status: 'processing', // Changed from 'pending' to 'processing' for webhook flow
        provider: PaymentProvider.SBERBANK,
        orderId: orderId,
        amount: 1299,
      });
    });

    const webhookResponse = await request(app.getHttpServer())
      .post(`/webhooks/${PaymentProvider.SBERBANK}`)
      .send({
        externalId,
        status: 'completed',
        amount: 1299,
        currency: 'RUB',
        signature: 'mock-happy-path-signature',
      });

    // Check if webhook was processed successfully
    if (webhookResponse.status !== 201) {
      throw new Error(
        `Webhook failed with status ${webhookResponse.status}: ${JSON.stringify(webhookResponse.body)}`,
      );
    }

    // Add a small delay to ensure async operations complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Debug info to understand what's happening
    const debugInfo = {
      orderServiceCalls: mockOrderService.getOrder.mock.calls.length,
      libraryServiceCalls:
        mockLibraryService.addGameToLibrary.mock.calls.length,
      paymentFindOneCalls: mockPaymentRepository.findOne.mock.calls.length,
      paymentSaveCalls: mockPaymentRepository.save.mock.calls.length,
      webhookStatus: webhookResponse.status,
      webhookBody: webhookResponse.body,
    };

    // If library service wasn't called, show debug info
    if (mockLibraryService.addGameToLibrary.mock.calls.length === 0) {
      throw new Error(
        `Library service not called. Debug info: ${JSON.stringify(debugInfo, null, 2)}`,
      );
    }

    // 5. Verify that the library service was called
    expect(mockLibraryService.addGameToLibrary).toHaveBeenCalled();
    expect(mockLibraryService.addGameToLibrary).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'e2e-user-id',
        gameId: mockGameInfo.id,
        orderId: orderId,
      }),
    );
  });
});
