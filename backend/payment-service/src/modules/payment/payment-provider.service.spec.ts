import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { PaymentProviderService } from './payment-provider.service';
import { PaymentProviderFactory } from './payment-provider.factory';
import { SberbankMockProvider } from './providers/sberbank.provider';
import { YMoneyMockProvider } from './providers/ymoney.provider';
import { TinkoffMockProvider } from './providers/tinkoff.provider';
import { PaymentProvider } from '../../common/enums/payment-provider.enum';
import { Payment } from './entities/payment.entity';

describe('PaymentProviderService', () => {
  let service: PaymentProviderService;

  const mockSberbankProvider = { processPayment: jest.fn() };
  const mockYMoneyProvider = { processPayment: jest.fn() };
  const mockTBankProvider = { processPayment: jest.fn() };

  const mockPaymentProviderFactory = {
    createProvider: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentProviderService,
        {
          provide: PaymentProviderFactory,
          useValue: mockPaymentProviderFactory,
        },
      ],
    }).compile();

    service = module.get<PaymentProviderService>(PaymentProviderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processPayment', () => {
    it('should call sberbank provider', async () => {
      const payment = { provider: PaymentProvider.SBERBANK } as Payment;
      mockPaymentProviderFactory.createProvider.mockReturnValue(
        mockSberbankProvider,
      );
      mockSberbankProvider.processPayment.mockResolvedValue({
        paymentUrl: 'test-url',
        externalId: 'test-id',
      });

      await service.processPayment(payment);

      expect(mockPaymentProviderFactory.createProvider).toHaveBeenCalledWith(
        PaymentProvider.SBERBANK,
      );
      expect(mockSberbankProvider.processPayment).toHaveBeenCalledWith(payment);
    });

    it('should call ymoney provider', async () => {
      const payment = { provider: PaymentProvider.YANDEX } as Payment;
      mockPaymentProviderFactory.createProvider.mockReturnValue(
        mockYMoneyProvider,
      );
      mockYMoneyProvider.processPayment.mockResolvedValue({
        paymentUrl: 'test-url',
        externalId: 'test-id',
      });

      await service.processPayment(payment);

      expect(mockPaymentProviderFactory.createProvider).toHaveBeenCalledWith(
        PaymentProvider.YANDEX,
      );
      expect(mockYMoneyProvider.processPayment).toHaveBeenCalledWith(payment);
    });

    it('should call tbank provider', async () => {
      const payment = { provider: PaymentProvider.TBANK } as Payment;
      mockPaymentProviderFactory.createProvider.mockReturnValue(
        mockTBankProvider,
      );
      mockTBankProvider.processPayment.mockResolvedValue({
        paymentUrl: 'test-url',
        externalId: 'test-id',
      });

      await service.processPayment(payment);

      expect(mockPaymentProviderFactory.createProvider).toHaveBeenCalledWith(
        PaymentProvider.TBANK,
      );
      expect(mockTBankProvider.processPayment).toHaveBeenCalledWith(payment);
    });

    it('should throw an error for unknown provider', async () => {
      const payment = { provider: 'unknown' } as any;
      mockPaymentProviderFactory.createProvider.mockReturnValue(null);

      await expect(service.processPayment(payment)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
