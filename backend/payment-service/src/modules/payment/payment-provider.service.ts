import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Payment } from './entities/payment.entity';
import { PaymentProvider } from '../../common/enums/payment-provider.enum';
import { PaymentProviderFactory } from './payment-provider.factory';

@Injectable()
export class PaymentProviderService {
  constructor(private readonly factory: PaymentProviderFactory) {}

  async processPayment(payment: Payment) {
    const provider = this.factory.createProvider(payment.provider);
    if (!provider) {
      throw new InternalServerErrorException(
        `Could not create provider for type: ${payment.provider}`,
      );
    }
    return provider.processPayment(payment);
  }

  async getPaymentStatus(providerType: PaymentProvider, externalId: string) {
    const provider = this.factory.createProvider(providerType);
    if (!provider) {
      throw new InternalServerErrorException(
        `Could not create provider for type: ${providerType}`,
      );
    }
    return provider.getPaymentStatus(externalId);
  }

  handleWebhook(providerType: PaymentProvider, data: any) {
    const provider = this.factory.createProvider(providerType);
    if (!provider) {
      throw new InternalServerErrorException(
        `Could not create provider for type: ${providerType}`,
      );
    }
    return provider.handleWebhook(data);
  }
}
