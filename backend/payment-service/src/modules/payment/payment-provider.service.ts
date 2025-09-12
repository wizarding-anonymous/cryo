import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Payment } from './entities/payment.entity';
import { PaymentProvider } from '../../common/enums/payment-provider.enum';
import { PaymentProviderInterface } from './interfaces/payment-provider.interface';
import { SberbankPaymentProvider } from './providers/sberbank.provider';
import { YMoneyPaymentProvider } from './providers/ymoney.provider';
import { TBankPaymentProvider } from './providers/tbank.provider';

@Injectable()
export class PaymentProviderService {
  constructor(
    private readonly sberbankProvider: SberbankPaymentProvider,
    private readonly ymoneyProvider: YMoneyPaymentProvider,
    private readonly tbankProvider: TBankPaymentProvider,
  ) {}

  private getProvider(provider: PaymentProvider): PaymentProviderInterface {
    switch (provider) {
      case PaymentProvider.SBERBANK:
        return this.sberbankProvider;
      case PaymentProvider.YANDEX:
        return this.ymoneyProvider;
      case PaymentProvider.TBANK:
        return this.tbankProvider;
      default:
        throw new InternalServerErrorException(`Unknown payment provider: ${provider}`);
    }
  }

  async processPayment(payment: Payment) {
    const provider = this.getProvider(payment.provider);
    return provider.processPayment(payment);
  }

  async getPaymentStatus(provider: PaymentProvider, externalId: string) {
    const providerInstance = this.getProvider(provider);
    return providerInstance.getPaymentStatus(externalId);
  }

  handleWebhook(provider: PaymentProvider, data: any) {
    const providerInstance = this.getProvider(provider);
    return providerInstance.handleWebhook(data);
  }
}
