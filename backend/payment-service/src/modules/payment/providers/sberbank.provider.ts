import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PaymentProviderInterface, ProcessPaymentResponse } from '../interfaces/payment-provider.interface';
import { Payment } from '../entities/payment.entity';
import { PaymentStatus } from '../../../common/enums/payment-status.enum';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SberbankPaymentProvider implements PaymentProviderInterface {
  constructor(private readonly configService: ConfigService) {}

  async processPayment(payment: Payment): Promise<ProcessPaymentResponse> {
    const externalId = `sber_${uuidv4()}`;
    const baseUrl = this.configService.get<string>('APP_URL');
    const paymentUrl = `${baseUrl}/payments/${payment.id}/mock-form`;

    console.log(`SBERBANK_PROVIDER: Processing payment ${payment.id}, assigned externalId ${externalId}`);

    return { paymentUrl, externalId };
  }

  async getPaymentStatus(externalId: string): Promise<{ status: string; providerResponse: any }> {
    console.log(`SBERBANK_PROVIDER: Getting status for externalId ${externalId}`);
    return {
      status: PaymentStatus.COMPLETED,
      providerResponse: { externalId, status: 'success', timestamp: new Date() },
    };
  }

  handleWebhook(data: any): { externalId: string; status: string } {
    console.log(`SBERBANK_PROVIDER: Handling webhook`);
    return {
      externalId: data.externalId,
      status: data.status === 'success' ? PaymentStatus.COMPLETED : PaymentStatus.FAILED,
    };
  }
}
