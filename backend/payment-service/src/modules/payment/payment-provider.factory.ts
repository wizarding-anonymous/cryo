import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider } from '../../common/enums/payment-provider.enum';
import { PaymentProviderInterface } from './interfaces/payment-provider.interface';
import { SberbankMockProvider } from './providers/sberbank.provider';
import { YMoneyMockProvider } from './providers/ymoney.provider';
import { TinkoffMockProvider } from './providers/tinkoff.provider';

export interface SimulationConfig {
  autoApprove: boolean;
  delayMs: number;
  successRate: number;
}

@Injectable()
export class PaymentProviderFactory {
  private readonly logger = new Logger(PaymentProviderFactory.name);

  constructor(private readonly configService: ConfigService) {}

  createProvider(providerType: PaymentProvider): PaymentProviderInterface {
    const mode = this.configService.get<string>('PAYMENT_MODE');
    this.logger.log(`Creating provider for type '${providerType}' in mode '${mode}'`);

    switch (mode) {
      case 'simulation':
        return this.createMockProvider(providerType);
      // case 'sandbox':
      //   return this.createSandboxProvider(providerType);
      // case 'production':
      //   return this.createProductionProvider(providerType);
      default:
        this.logger.error(`Unknown payment mode: ${mode}`);
        throw new Error(`Unknown payment mode: ${mode}`);
    }
  }

  private createMockProvider(type: PaymentProvider): PaymentProviderInterface {
    const config: SimulationConfig = {
      autoApprove: this.configService.get<boolean>('PAYMENT_AUTO_APPROVE', true),
      delayMs: this.configService.get<number>('PAYMENT_DELAY_MS', 1000),
      successRate: this.configService.get<number>('PAYMENT_SUCCESS_RATE', 0.95),
    };

    this.logger.log(`Creating mock provider with config: ${JSON.stringify(config)}`);

    switch (type) {
      case PaymentProvider.SBERBANK:
        return new SberbankMockProvider(config);
      case PaymentProvider.YANDEX:
        return new YMoneyMockProvider(config);
      case PaymentProvider.TBANK:
        return new TinkoffMockProvider(config);
      default:
        this.logger.error(`Unknown mock provider type: ${type}`);
        throw new Error(`Unknown mock provider type: ${type}`);
    }
  }
}
