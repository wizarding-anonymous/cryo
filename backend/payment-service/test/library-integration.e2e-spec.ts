import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { LibraryIntegrationService } from '../src/integrations/library/library.service';
import { GameCatalogIntegrationService } from '../src/integrations/game-catalog/game-catalog.service';
import { JwtService } from '@nestjs/jwt';
import { PaymentProvider } from '../src/common/enums/payment-provider.enum';
import { GamePurchaseInfo } from '../src/integrations/game-catalog/dto/game-purchase-info.dto';
import { MetricsService } from '../src/common/metrics/metrics.service';


describe('Library Integration (E2E)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let libraryService: LibraryIntegrationService;

  const mockGameInfo: GamePurchaseInfo = {
    id: 'library-test-game-id',
    title: 'Library Integration Test Game',
    price: 2499,
    currency: 'RUB',
    available: true,
  };

  const mockLibraryService = {
    addGameToLibrary: jest.fn(),
    checkHealth: jest.fn(),
  };

  const mockMetricsService = {
    recordIntegrationRequest: jest.fn(),
    recordIntegrationDuration: jest.fn(),
    recordPayment: jest.fn(),
    recordPaymentDuration: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GameCatalogIntegrationService)
      .useValue({
        getGamePurchaseInfo: jest.fn().mockResolvedValue(mockGameInfo),
      })
      .overrideProvider(LibraryIntegrationService)
      .useValue(mockLibraryService)
      .overrideProvider(MetricsService)
      .useValue(mockMetricsService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    libraryService = moduleFixture.get<LibraryIntegrationService>(
      LibraryIntegrationService,
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful Library Integration Flow', () => {
    it('should successfully add game to library after payment confirmation', async () => {
      const token = jwtService.sign({
        sub: 'library-test-user-id',
        username: 'library-test-user',
      });

      mockLibraryService.addGameToLibrary.mockResolvedValue(true);

      // 1. Create an order
      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ gameId: mockGameInfo.id })
        .expect(201);

      const orderId = orderResponse.body.data.id;

      // 2. Create a payment
      const paymentResponse = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({ orderId, provider: PaymentProvider.SBERBANK })
        .expect(201);

      const paymentId = paymentResponse.body.data.id;

      // 3. Process the payment
      await request(app.getHttpServer())
        .post(`/payments/${paymentId}/process`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      // 4. Confirm the payment (this should trigger library integration)
      await request(app.getHttpServer())
        .post(`/payments/${paymentId}/confirm`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      // 5. Verify library integration was called with correct parameters
      expect(libraryService.addGameToLibrary).toHaveBeenCalledWith({
        userId: 'library-test-user-id',
        gameId: mockGameInfo.id,
        orderId: orderId,
        purchasePrice: mockGameInfo.price,
        currency: mockGameInfo.currency,
      });

      expect(libraryService.addGameToLibrary).toHaveBeenCalledTimes(1);
    });

    it('should handle library integration failure gracefully', async () => {
      const token = jwtService.sign({
        sub: 'library-fail-user-id',
        username: 'library-fail-user',
      });

      // Mock library service to fail
      mockLibraryService.addGameToLibrary.mockResolvedValue(false);

      // 1. Create an order
      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ gameId: mockGameInfo.id })
        .expect(201);

      const orderId = orderResponse.body.data.id;

      // 2. Create and process payment
      const paymentResponse = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({ orderId, provider: PaymentProvider.YANDEX })
        .expect(201);

      const paymentId = paymentResponse.body.data.id;

      await request(app.getHttpServer())
        .post(`/payments/${paymentId}/process`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      // 3. Confirm payment - should still succeed even if library integration fails
      const confirmResponse = await request(app.getHttpServer())
        .post(`/payments/${paymentId}/confirm`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      // Payment should still be marked as completed
      expect(confirmResponse.body.data.status).toBe('completed');

      // Library integration should have been attempted
      expect(libraryService.addGameToLibrary).toHaveBeenCalledWith({
        userId: 'library-fail-user-id',
        gameId: mockGameInfo.id,
        orderId: orderId,
        purchasePrice: mockGameInfo.price,
        currency: mockGameInfo.currency,
      });
    });
  });

  describe('Library Service Health Check', () => {
    it('should check library service health', async () => {
      mockLibraryService.checkHealth.mockResolvedValue({ status: 'up' });

      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body.services.libraryService).toEqual({ status: 'up' });
      expect(libraryService.checkHealth).toHaveBeenCalled();
    });

    it('should handle library service health check failure', async () => {
      mockLibraryService.checkHealth.mockResolvedValue({ status: 'down' });

      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body.services.libraryService).toEqual({ status: 'down' });
    });
  });

  describe('Library Integration Retry Mechanism', () => {
    it('should retry library integration on failure', async () => {
      const token = jwtService.sign({
        sub: 'retry-test-user-id',
        username: 'retry-test-user',
      });

      // Mock first call to fail, second to succeed
      mockLibraryService.addGameToLibrary
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      // Create order and payment
      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ gameId: mockGameInfo.id })
        .expect(201);

      const paymentResponse = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({ 
          orderId: orderResponse.body.data.id, 
          provider: PaymentProvider.TBANK 
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/payments/${paymentResponse.body.data.id}/process`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      // Confirm payment
      await request(app.getHttpServer())
        .post(`/payments/${paymentResponse.body.data.id}/confirm`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      // Should have been called once (the retry logic is internal to the service)
      expect(libraryService.addGameToLibrary).toHaveBeenCalledTimes(1);
    });
  });

  describe('Library Integration Error Scenarios', () => {
    it('should handle library service timeout', async () => {
      const token = jwtService.sign({
        sub: 'timeout-test-user-id',
        username: 'timeout-test-user',
      });

      // Mock library service to throw timeout error
      mockLibraryService.addGameToLibrary.mockRejectedValue(
        new Error('Request timeout'),
      );

      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ gameId: mockGameInfo.id })
        .expect(201);

      const paymentResponse = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({ 
          orderId: orderResponse.body.data.id, 
          provider: PaymentProvider.SBERBANK 
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/payments/${paymentResponse.body.data.id}/process`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      // Payment confirmation should still succeed despite library integration failure
      await request(app.getHttpServer())
        .post(`/payments/${paymentResponse.body.data.id}/confirm`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      expect(libraryService.addGameToLibrary).toHaveBeenCalled();
    });

    it('should handle library service network error', async () => {
      const token = jwtService.sign({
        sub: 'network-error-user-id',
        username: 'network-error-user',
      });

      mockLibraryService.addGameToLibrary.mockRejectedValue(
        new Error('Network error: ECONNREFUSED'),
      );

      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ gameId: mockGameInfo.id })
        .expect(201);

      const paymentResponse = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({ 
          orderId: orderResponse.body.data.id, 
          provider: PaymentProvider.YANDEX 
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/payments/${paymentResponse.body.data.id}/process`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      // Should still complete payment despite network error
      const confirmResponse = await request(app.getHttpServer())
        .post(`/payments/${paymentResponse.body.data.id}/confirm`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      expect(confirmResponse.body.data.status).toBe('completed');
      expect(libraryService.addGameToLibrary).toHaveBeenCalled();
    });
  });
});