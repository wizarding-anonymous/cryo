import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PaymentProviderFactory } from './payment-provider.factory';
import { PaymentProvider } from '../../common/enums/payment-provider.enum';
import { SberbankMockProvider } from './providers/sberbank.provider';
import { YandexMoneyMockProvider } from './providers/ymoney.provider';
import { TinkoffMockProvider } from './providers/tinkoff.provider';

describe('PaymentProviderFactory', () => {
  let factory: PaymentProviderFactory;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentProviderFactory,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    factory = module.get<PaymentProviderFactory>(PaymentProviderFactory);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createProvider', () => {
    it('should create a SberbankMockProvider in simulation mode', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'PAYMENT_MODE') return 'simulation';
        return jest.requireActual('@nestjs/config').ConfigService.prototype.get(key);
      });
      const provider = factory.createProvider(PaymentProvider.SBERBANK);
      expect(provider).toBeInstanceOf(SberbankMockProvider);
    });

    it('should create a YandexMoneyMockProvider in simulation mode', () => {
      mockConfigService.get.mockReturnValue('simulation');
      const provider = factory.createProvider(PaymentProvider.YANDEX);
      expect(provider).toBeInstanceOf(YandexMoneyMockProvider);
    });

    it('should create a TinkoffMockProvider in simulation mode', () => {
      mockConfigService.get.mockReturnValue('simulation');
      const provider = factory.createProvider(PaymentProvider.TBANK);
      expect(provider).toBeInstanceOf(TinkoffMockProvider);
    });

    it('should throw an error for an unknown mode', () => {
      mockConfigService.get.mockReturnValue('unknown_mode');
      expect(() => factory.createProvider(PaymentProvider.SBERBANK)).toThrow('Unknown payment mode: unknown_mode');
    });

    it('should throw an error for an unknown provider type in simulation mode', () => {
        mockConfigService.get.mockReturnValue('simulation');
        expect(() => factory.createProvider('unknown' as PaymentProvider)).toThrow('Unknown mock provider type: unknown');
    });
  });
});
