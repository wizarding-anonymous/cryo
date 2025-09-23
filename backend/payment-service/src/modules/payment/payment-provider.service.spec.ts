import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { PaymentProviderService } from './payment-provider.service';
import { PaymentProviderFactory } from './payment-provider.factory';
import { Payment } from './entities/payment.entity';
import { PaymentProvider } from '../../common/enums/payment-provider.enum';
import { PaymentStatus } from '../../common/enums/payment-status.enum';

describe('PaymentProviderService', () => {
  let service: PaymentProviderService;
  let factory: jest.Mocked<PaymentProviderFactory>;

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

  const mockProvider = {
    processPayment: jest.fn(),
    getPaymentStatus: jest.fn(),
    handleWebhook: jest.fn(),
  };

  beforeEach(async () => {
    const mockFactory = {
      createProvider: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentProviderService,
        {
          provide: PaymentProviderFactory,
          useValue: mockFactory,
        },
      ],
    }).compile();

    service = module.get<PaymentProviderService>(PaymentProviderService);
    factory = module.get(PaymentProviderFactory);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processPayment', () => {
    it('should process payment successfully', async () => {
      const expectedResult = {
        paymentUrl: 'https://mock-payment-url.com',
        externalId: 'ext-123',
      };

      factory.createProvider.mockReturnValue(mockProvider);
      mockProvider.processPayment.mockResolvedValue(expectedResult);

      const result = await service.processPayment(mockPayment);

      expect(factory.createProvider).toHaveBeenCalledWith(
        PaymentProvider.SBERBANK,
      );
      expect(mockProvider.processPayment).toHaveBeenCalledWith(mockPayment);
      expect(result).toEqual(expectedResult);
    });

    it('should throw InternalServerErrorException when provider creation fails', async () => {
      factory.createProvider.mockReturnValue(null);

      await expect(service.processPayment(mockPayment)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(factory.createProvider).toHaveBeenCalledWith(
        PaymentProvider.SBERBANK,
      );
    });
  });

  describe('getPaymentStatus', () => {
    it('should get payment status successfully', async () => {
      const expectedStatus = { status: 'completed', externalId: 'ext-123' };

      factory.createProvider.mockReturnValue(mockProvider);
      mockProvider.getPaymentStatus.mockResolvedValue(expectedStatus);

      const result = await service.getPaymentStatus(
        PaymentProvider.YANDEX,
        'ext-123',
      );

      expect(factory.createProvider).toHaveBeenCalledWith(
        PaymentProvider.YANDEX,
      );
      expect(mockProvider.getPaymentStatus).toHaveBeenCalledWith('ext-123');
      expect(result).toEqual(expectedStatus);
    });

    it('should throw InternalServerErrorException when provider creation fails', async () => {
      factory.createProvider.mockReturnValue(null);

      await expect(
        service.getPaymentStatus(PaymentProvider.YANDEX, 'ext-123'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('handleWebhook', () => {
    it('should handle webhook successfully', async () => {
      const webhookData = { status: 'completed', externalId: 'ext-123' };
      const expectedResult = { processed: true };

      factory.createProvider.mockReturnValue(mockProvider);
      mockProvider.handleWebhook.mockReturnValue(expectedResult);

      const result = service.handleWebhook(PaymentProvider.TBANK, webhookData);

      expect(factory.createProvider).toHaveBeenCalledWith(
        PaymentProvider.TBANK,
      );
      expect(mockProvider.handleWebhook).toHaveBeenCalledWith(webhookData);
      expect(result).toEqual(expectedResult);
    });

    it('should throw InternalServerErrorException when provider creation fails', async () => {
      const webhookData = { status: 'completed', externalId: 'ext-123' };
      factory.createProvider.mockReturnValue(null);

      expect(() =>
        service.handleWebhook(PaymentProvider.TBANK, webhookData),
      ).toThrow(InternalServerErrorException);
    });
  });
});
