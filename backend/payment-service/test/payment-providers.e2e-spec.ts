import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { PaymentProvider } from '../src/common/enums/payment-provider.enum';
import { PaymentStatus } from '../src/common/enums/payment-status.enum';
import { OrderStatus } from '../src/common/enums/order-status.enum';

describe('Payment Providers E2E Tests', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    authToken = jwtService.sign({
      sub: 'e2e-provider-test-user',
      username: 'provider-test-user',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Sberbank Payment Provider', () => {
    let orderId: string;
    let paymentId: string;

    it('should create an order for Sberbank payment', async () => {
      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          gameId: 'sberbank-game-123',
          gameName: 'Sberbank Test Game',
          amount: 1500,
        })
        .expect(201);

      orderId = response.body.data.id;
      expect(orderId).toBeDefined();
    });

    it('should create a Sberbank payment', async () => {
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
      expect(response.body.data.provider).toBe(PaymentProvider.SBERBANK);
      expect(response.body.data.status).toBe(PaymentStatus.PENDING);
    });

    it('should process Sberbank payment and return mock URL', async () => {
      const response = await request(app.getHttpServer())
        .post(`/payments/${paymentId}/process`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.data.paymentUrl).toContain(
        '/mock/sberbank/payment-form',
      );
      expect(response.body.data.paymentUrl).toContain(paymentId);
    });

    it('should handle Sberbank webhook for successful payment', async () => {
      // First get the payment to get the external ID
      const paymentResponse = await request(app.getHttpServer())
        .get(`/payments/${paymentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const externalId = paymentResponse.body.data.externalId;
      expect(externalId).toMatch(/^sber_\d+_[a-f0-9]{8}$/);

      // Send webhook
      await request(app.getHttpServer())
        .post(`/webhooks/${PaymentProvider.SBERBANK}`)
        .send({
          orderNumber: externalId,
          orderStatus: 2, // Paid
          amount: 1500,
          currency: 'RUB',
        })
        .expect(200);

      // Verify payment status
      const updatedPaymentResponse = await request(app.getHttpServer())
        .get(`/payments/${paymentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(updatedPaymentResponse.body.data.status).toBe(
        PaymentStatus.COMPLETED,
      );
    });
  });

  describe('YMoney Payment Provider', () => {
    let orderId: string;
    let paymentId: string;

    it('should create an order for YMoney payment', async () => {
      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          gameId: 'ymoney-game-456',
          gameName: 'YMoney Test Game',
          amount: 2000,
        })
        .expect(201);

      orderId = response.body.data.id;
      expect(orderId).toBeDefined();
    });

    it('should create a YMoney payment', async () => {
      const response = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: orderId,
          provider: PaymentProvider.YANDEX,
        })
        .expect(201);

      paymentId = response.body.data.id;
      expect(paymentId).toBeDefined();
      expect(response.body.data.provider).toBe(PaymentProvider.YANDEX);
      expect(response.body.data.status).toBe(PaymentStatus.PENDING);
    });

    it('should process YMoney payment and return mock URL', async () => {
      const response = await request(app.getHttpServer())
        .post(`/payments/${paymentId}/process`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.data.paymentUrl).toContain(
        '/mock/ymoney/payment-form',
      );
      expect(response.body.data.paymentUrl).toContain(paymentId);
    });

    it('should handle YMoney webhook for successful payment', async () => {
      // First get the payment to get the external ID
      const paymentResponse = await request(app.getHttpServer())
        .get(`/payments/${paymentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const externalId = paymentResponse.body.data.externalId;
      expect(externalId).toMatch(/^ym_\d+_[a-f0-9]{8}$/);

      // Send webhook
      await request(app.getHttpServer())
        .post(`/webhooks/${PaymentProvider.YANDEX}`)
        .send({
          operation_id: externalId,
          status: 'success',
          amount: 2000,
          currency: 'RUB',
        })
        .expect(200);

      // Verify payment status
      const updatedPaymentResponse = await request(app.getHttpServer())
        .get(`/payments/${paymentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(updatedPaymentResponse.body.data.status).toBe(
        PaymentStatus.COMPLETED,
      );
    });
  });

  describe('T-Bank Payment Provider', () => {
    let orderId: string;
    let paymentId: string;

    it('should create an order for T-Bank payment', async () => {
      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          gameId: 'tbank-game-789',
          gameName: 'T-Bank Test Game',
          amount: 2500,
        })
        .expect(201);

      orderId = response.body.data.id;
      expect(orderId).toBeDefined();
    });

    it('should create a T-Bank payment', async () => {
      const response = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: orderId,
          provider: PaymentProvider.TBANK,
        })
        .expect(201);

      paymentId = response.body.data.id;
      expect(paymentId).toBeDefined();
      expect(response.body.data.provider).toBe(PaymentProvider.TBANK);
      expect(response.body.data.status).toBe(PaymentStatus.PENDING);
    });

    it('should process T-Bank payment and return mock URL', async () => {
      const response = await request(app.getHttpServer())
        .post(`/payments/${paymentId}/process`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.data.paymentUrl).toContain(
        '/mock/tbank/payment-form',
      );
      expect(response.body.data.paymentUrl).toContain(paymentId);
    });

    it('should handle T-Bank webhook for successful payment', async () => {
      // First get the payment to get the external ID
      const paymentResponse = await request(app.getHttpServer())
        .get(`/payments/${paymentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const externalId = paymentResponse.body.data.externalId;
      expect(externalId).toMatch(/^tb_\d+_[a-f0-9]{8}$/);

      // Send webhook
      await request(app.getHttpServer())
        .post(`/webhooks/${PaymentProvider.TBANK}`)
        .send({
          PaymentId: externalId,
          Status: 'CONFIRMED',
          Amount: 2500,
          Currency: 'RUB',
        })
        .expect(200);

      // Verify payment status
      const updatedPaymentResponse = await request(app.getHttpServer())
        .get(`/payments/${paymentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(updatedPaymentResponse.body.data.status).toBe(
        PaymentStatus.COMPLETED,
      );
    });
  });

  describe('Payment Cancellation Flow', () => {
    let orderId: string;
    let paymentId: string;

    it('should create an order and payment for cancellation test', async () => {
      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          gameId: 'cancel-game-999',
          gameName: 'Cancellation Test Game',
          amount: 1000,
        })
        .expect(201);

      orderId = orderResponse.body.data.id;

      const paymentResponse = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: orderId,
          provider: PaymentProvider.SBERBANK,
        })
        .expect(201);

      paymentId = paymentResponse.body.data.id;
    });

    it('should cancel payment successfully', async () => {
      const response = await request(app.getHttpServer())
        .post(`/payments/${paymentId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.status).toBe(PaymentStatus.CANCELLED);

      // Verify order status is also updated
      const orderResponse = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(orderResponse.body.data.status).toBe(OrderStatus.CANCELLED);
    });
  });

  describe('Payment Failure Scenarios', () => {
    let orderId: string;
    let paymentId: string;

    beforeEach(async () => {
      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          gameId: 'failure-game-000',
          gameName: 'Failure Test Game',
          amount: 500,
        })
        .expect(201);

      orderId = orderResponse.body.data.id;

      const paymentResponse = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: orderId,
          provider: PaymentProvider.SBERBANK,
        })
        .expect(201);

      paymentId = paymentResponse.body.data.id;

      // Process the payment to get external ID
      await request(app.getHttpServer())
        .post(`/payments/${paymentId}/process`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);
    });

    it('should handle Sberbank webhook for failed payment', async () => {
      const paymentResponse = await request(app.getHttpServer())
        .get(`/payments/${paymentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const externalId = paymentResponse.body.data.externalId;

      // Send failure webhook
      await request(app.getHttpServer())
        .post(`/webhooks/${PaymentProvider.SBERBANK}`)
        .send({
          orderNumber: externalId,
          orderStatus: 3, // Cancelled
          amount: 500,
          currency: 'RUB',
        })
        .expect(200);

      // Verify payment status
      const updatedPaymentResponse = await request(app.getHttpServer())
        .get(`/payments/${paymentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(updatedPaymentResponse.body.data.status).toBe(
        PaymentStatus.FAILED,
      );
    });

    it('should handle YMoney webhook for refused payment', async () => {
      // Create new payment for YMoney test
      const orderResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          gameId: 'ymoney-failure-001',
          gameName: 'YMoney Failure Test',
          amount: 750,
        })
        .expect(201);

      const ymoneyOrderId = orderResponse.body.data.id;

      const paymentResponse = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: ymoneyOrderId,
          provider: PaymentProvider.YANDEX,
        })
        .expect(201);

      const ymoneyPaymentId = paymentResponse.body.data.id;

      await request(app.getHttpServer())
        .post(`/payments/${ymoneyPaymentId}/process`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      const processedPaymentResponse = await request(app.getHttpServer())
        .get(`/payments/${ymoneyPaymentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const externalId = processedPaymentResponse.body.data.externalId;

      // Send failure webhook
      await request(app.getHttpServer())
        .post(`/webhooks/${PaymentProvider.YANDEX}`)
        .send({
          operation_id: externalId,
          status: 'refused',
          amount: 750,
          currency: 'RUB',
        })
        .expect(200);

      // Verify payment status
      const updatedPaymentResponse = await request(app.getHttpServer())
        .get(`/payments/${ymoneyPaymentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(updatedPaymentResponse.body.data.status).toBe(
        PaymentStatus.FAILED,
      );
    });
  });
});
