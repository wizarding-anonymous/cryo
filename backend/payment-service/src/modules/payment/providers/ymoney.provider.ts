import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Payment } from '../entities/payment.entity';
import { PaymentProviderInterface, ProcessPaymentResponse } from '../interfaces/payment-provider.interface';
import { SimulationConfig } from '../payment-provider.factory';

@Injectable()
export class YandexMoneyMockProvider implements PaymentProviderInterface {
  constructor(private readonly config: SimulationConfig) {}

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async processPayment(payment: Payment): Promise<ProcessPaymentResponse> {
    await this.delay(this.config.delayMs);

    const success = Math.random() < this.config.successRate;
    const externalId = `ymoney_mock_${uuidv4()}`;

    const paymentUrl = success
      ? `/mock/payment/success/${payment.id}`
      : `/mock/payment/failure/${payment.id}`;

    return {
      paymentUrl,
      externalId,
    };
  }

  async getPaymentStatus(externalId: string): Promise<{ status: string; providerResponse: any }> {
    return Promise.resolve({ status: 'completed', providerResponse: { externalId, mock: true } });
  }

  handleWebhook(data: any): { externalId: string; status: string } {
    const { externalId, status } = data;
    return { externalId, status };
  }
}
