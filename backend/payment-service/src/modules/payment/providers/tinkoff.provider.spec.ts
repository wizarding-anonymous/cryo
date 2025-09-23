import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { TinkoffMockProvider } from './tinkoff.provider';
import { Payment } from '../entities/payment.entity';
import { PaymentProvider } from '../../../common/enums/payment-provider.enum';
import { PaymentStatus } from '../../../common/enums/payment-status.enum';
import { SimulationConfig } from '../payment-provider.factory';

describe('TinkoffMockProvider', () => {
  let provider: TinkoffMockProvider;
  let mockConfig: SimulationConfig;

  const mockPayment: Payment = {
    id: 'payment-123',
    orderId: 'order-123',
    order: null,
    provider: PaymentProvider.TBANK,
    amount: 1999,
    currency: 'RUB',
    status: PaymentStatus.PENDING,
    externalId: null,
    providerResponse: null,
    failureReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
  };

  beforeEach(async () => {
    mockConfig = {
      autoApprove: true,
      delayMs: 100,
      successRate: 0.8,
      mockUrl: 'http://localhost:3003/mock/tbank',
      mockApiKey: 'test_key',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: TinkoffMockProvider,
          useFactory: () => new TinkoffMockProvider(mockConfig),
        },
      ],
    }).compile();

    provider = module.get<TinkoffMockProvider>(TinkoffMockProvider);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('processPayment', () => {
    it('should process payment and return payment URL and external ID', async () => {
      const result = await provider.processPayment(mockPayment);

      expect(result).toHaveProperty('paymentUrl');
      expect(result).toHaveProperty('externalId');
      expect(result.paymentUrl).toContain(
        '/mock/tbank/payment-form/payment-123',
      );
      expect(result.externalId).toMatch(/^tb_\d+_[a-f0-9]{8}$/);
    });

    it('should generate unique external IDs for different payments', async () => {
      const result1 = await provider.processPayment(mockPayment);
      const result2 = await provider.processPayment({
        ...mockPayment,
        id: 'payment-456',
      });

      expect(result1.externalId).not.toEqual(result2.externalId);
      expect(result1.paymentUrl).not.toEqual(result2.paymentUrl);
    });

    it('should respect the configured delay', async () => {
      const startTime = Date.now();
      await provider.processPayment(mockPayment);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(mockConfig.delayMs);
    });
  });

  describe('getPaymentStatus', () => {
    it('should return payment status with provider response', async () => {
      const externalId = 'tb_123456_abcd1234';
      const result = await provider.getPaymentStatus(externalId);

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('providerResponse');
      expect(['completed', 'failed']).toContain(result.status);
      expect(result.providerResponse).toMatchObject({
        externalId,
        currency: 'RUB',
        provider: 'tbank',
        mock: true,
      });
    });

    it('should include T-Bank-specific fields in provider response', async () => {
      const externalId = 'tb_123456_abcd1234';
      const result = await provider.getPaymentStatus(externalId);

      expect(result.providerResponse).toHaveProperty('tbankPaymentId');
      expect(result.providerResponse).toHaveProperty('paymentMethod');
      expect(result.providerResponse.tbankPaymentId).toMatch(/^TB\d+$/);
      expect(result.providerResponse.paymentMethod).toBe('card');
    });
  });

  describe('handleWebhook', () => {
    it('should handle T-Bank webhook with CONFIRMED status', () => {
      const webhookData = {
        PaymentId: 'tb_123456_abcd1234',
        Status: 'CONFIRMED',
        Amount: 1999,
        Currency: 'RUB',
      };

      const result = provider.handleWebhook(webhookData);

      expect(result).toEqual({
        externalId: 'tb_123456_abcd1234',
        status: 'completed',
      });
    });

    it('should handle T-Bank webhook with REJECTED status', () => {
      const webhookData = {
        PaymentId: 'tb_123456_abcd1234',
        Status: 'REJECTED',
        Amount: 1999,
        Currency: 'RUB',
      };

      const result = provider.handleWebhook(webhookData);

      expect(result).toEqual({
        externalId: 'tb_123456_abcd1234',
        status: 'failed',
      });
    });

    it('should handle T-Bank webhook with CANCELED status', () => {
      const webhookData = {
        PaymentId: 'tb_123456_abcd1234',
        Status: 'CANCELED',
        Amount: 1999,
        Currency: 'RUB',
      };

      const result = provider.handleWebhook(webhookData);

      expect(result).toEqual({
        externalId: 'tb_123456_abcd1234',
        status: 'failed',
      });
    });

    it('should handle T-Bank webhook with REFUNDED status', () => {
      const webhookData = {
        PaymentId: 'tb_123456_abcd1234',
        Status: 'REFUNDED',
        Amount: 1999,
        Currency: 'RUB',
      };

      const result = provider.handleWebhook(webhookData);

      expect(result).toEqual({
        externalId: 'tb_123456_abcd1234',
        status: 'failed',
      });
    });

    it('should handle T-Bank webhook with NEW status', () => {
      const webhookData = {
        PaymentId: 'tb_123456_abcd1234',
        Status: 'NEW',
        Amount: 1999,
        Currency: 'RUB',
      };

      const result = provider.handleWebhook(webhookData);

      expect(result).toEqual({
        externalId: 'tb_123456_abcd1234',
        status: 'pending',
      });
    });

    it('should handle T-Bank webhook with AUTHORIZING status', () => {
      const webhookData = {
        PaymentId: 'tb_123456_abcd1234',
        Status: 'AUTHORIZING',
        Amount: 1999,
        Currency: 'RUB',
      };

      const result = provider.handleWebhook(webhookData);

      expect(result).toEqual({
        externalId: 'tb_123456_abcd1234',
        status: 'pending',
      });
    });

    it('should handle webhook with fallback external ID', () => {
      const webhookData = {
        externalId: 'fallback_external_id',
        Status: 'CONFIRMED',
        Amount: 1999,
        Currency: 'RUB',
      };

      const result = provider.handleWebhook(webhookData);

      expect(result).toEqual({
        externalId: 'fallback_external_id',
        status: 'completed',
      });
    });

    it('should handle unknown status as pending', () => {
      const webhookData = {
        PaymentId: 'tb_123456_abcd1234',
        Status: 'UNKNOWN_STATUS',
        Amount: 1999,
        Currency: 'RUB',
      };

      const result = provider.handleWebhook(webhookData);

      expect(result).toEqual({
        externalId: 'tb_123456_abcd1234',
        status: 'pending',
      });
    });
  });
});
