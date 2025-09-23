import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { SberbankMockProvider } from './sberbank.provider';
import { Payment } from '../entities/payment.entity';
import { PaymentProvider } from '../../../common/enums/payment-provider.enum';
import { PaymentStatus } from '../../../common/enums/payment-status.enum';
import { SimulationConfig } from '../payment-provider.factory';

describe('SberbankMockProvider', () => {
  let provider: SberbankMockProvider;
  let mockConfig: SimulationConfig;

  const mockPayment: Payment = {
    id: 'payment-123',
    orderId: 'order-123',
    order: null,
    provider: PaymentProvider.SBERBANK,
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
      mockUrl: 'http://localhost:3003/mock/sberbank',
      mockApiKey: 'test_key',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: SberbankMockProvider,
          useFactory: () => new SberbankMockProvider(mockConfig),
        },
      ],
    }).compile();

    provider = module.get<SberbankMockProvider>(SberbankMockProvider);
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
        '/mock/sberbank/payment-form/payment-123',
      );
      expect(result.externalId).toMatch(/^sber_\d+_[a-f0-9]{8}$/);
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
      const externalId = 'sber_123456_abcd1234';
      const result = await provider.getPaymentStatus(externalId);

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('providerResponse');
      expect(['completed', 'failed']).toContain(result.status);
      expect(result.providerResponse).toMatchObject({
        externalId,
        currency: 'RUB',
        provider: 'sberbank',
        mock: true,
      });
    });

    it('should include Sberbank-specific fields in provider response', async () => {
      const externalId = 'sber_123456_abcd1234';
      const result = await provider.getPaymentStatus(externalId);

      expect(result.providerResponse).toHaveProperty('sberbankOrderId');
      expect(result.providerResponse.sberbankOrderId).toMatch(/^SB\d+$/);
    });
  });

  describe('handleWebhook', () => {
    it('should handle Sberbank webhook with paid status', () => {
      const webhookData = {
        orderNumber: 'sber_123456_abcd1234',
        orderStatus: 2, // Paid
        amount: 1999,
        currency: 'RUB',
      };

      const result = provider.handleWebhook(webhookData);

      expect(result).toEqual({
        externalId: 'sber_123456_abcd1234',
        status: 'completed',
      });
    });

    it('should handle Sberbank webhook with cancelled status', () => {
      const webhookData = {
        orderNumber: 'sber_123456_abcd1234',
        orderStatus: 3, // Cancelled
        amount: 1999,
        currency: 'RUB',
      };

      const result = provider.handleWebhook(webhookData);

      expect(result).toEqual({
        externalId: 'sber_123456_abcd1234',
        status: 'failed',
      });
    });

    it('should handle Sberbank webhook with refunded status', () => {
      const webhookData = {
        orderNumber: 'sber_123456_abcd1234',
        orderStatus: 4, // Refunded
        amount: 1999,
        currency: 'RUB',
      };

      const result = provider.handleWebhook(webhookData);

      expect(result).toEqual({
        externalId: 'sber_123456_abcd1234',
        status: 'failed',
      });
    });

    it('should handle Sberbank webhook with registered status', () => {
      const webhookData = {
        orderNumber: 'sber_123456_abcd1234',
        orderStatus: 1, // Registered
        amount: 1999,
        currency: 'RUB',
      };

      const result = provider.handleWebhook(webhookData);

      expect(result).toEqual({
        externalId: 'sber_123456_abcd1234',
        status: 'pending',
      });
    });

    it('should handle webhook with fallback external ID', () => {
      const webhookData = {
        externalId: 'fallback_external_id',
        orderStatus: 2,
        amount: 1999,
        currency: 'RUB',
      };

      const result = provider.handleWebhook(webhookData);

      expect(result).toEqual({
        externalId: 'fallback_external_id',
        status: 'completed',
      });
    });

    it('should handle unknown status as pending', () => {
      const webhookData = {
        orderNumber: 'sber_123456_abcd1234',
        orderStatus: 999, // Unknown status
        amount: 1999,
        currency: 'RUB',
      };

      const result = provider.handleWebhook(webhookData);

      expect(result).toEqual({
        externalId: 'sber_123456_abcd1234',
        status: 'pending',
      });
    });
  });
});
