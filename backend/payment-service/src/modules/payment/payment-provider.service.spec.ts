import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { PaymentProviderService } from './payment-provider.service';
import { SberbankPaymentProvider } from './providers/sberbank.provider';
import { YMoneyPaymentProvider } from './providers/ymoney.provider';
import { TBankPaymentProvider } from './providers/tbank.provider';
import { PaymentProvider } from '../../common/enums/payment-provider.enum';
import { Payment } from './entities/payment.entity';

describe('PaymentProviderService', () => {
  let service: PaymentProviderService;
  let sberbankProvider: SberbankPaymentProvider;
  let ymoneyProvider: YMoneyPaymentProvider;
  let tbankProvider: TBankPaymentProvider;

  const mockSberbankProvider = { processPayment: jest.fn() };
  const mockYMoneyProvider = { processPayment: jest.fn() };
  const mockTBankProvider = { processPayment: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentProviderService,
        { provide: SberbankPaymentProvider, useValue: mockSberbankProvider },
        { provide: YMoneyPaymentProvider, useValue: mockYMoneyProvider },
        { provide: TBankPaymentProvider, useValue: mockTBankProvider },
      ],
    }).compile();

    service = module.get<PaymentProviderService>(PaymentProviderService);
    sberbankProvider = module.get<SberbankPaymentProvider>(SberbankPaymentProvider);
    ymoneyProvider = module.get<YMoneyPaymentProvider>(YMoneyPaymentProvider);
    tbankProvider = module.get<TBankPaymentProvider>(TBankPaymentProvider);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processPayment', () => {
    it('should call sberbank provider', async () => {
      const payment = { provider: PaymentProvider.SBERBANK } as Payment;
      await service.processPayment(payment);
      expect(sberbankProvider.processPayment).toHaveBeenCalledWith(payment);
    });

    it('should call ymoney provider', async () => {
      const payment = { provider: PaymentProvider.YANDEX } as Payment;
      await service.processPayment(payment);
      expect(ymoneyProvider.processPayment).toHaveBeenCalledWith(payment);
    });

    it('should call tbank provider', async () => {
      const payment = { provider: PaymentProvider.TBANK } as Payment;
      await service.processPayment(payment);
      expect(tbankProvider.processPayment).toHaveBeenCalledWith(payment);
    });

    it('should throw an error for unknown provider', async () => {
      const payment = { provider: 'unknown' } as any;
      await expect(service.processPayment(payment)).rejects.toThrow(InternalServerErrorException);
    });
  });
});
