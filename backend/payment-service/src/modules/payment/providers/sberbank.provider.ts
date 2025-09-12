import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Payment } from '../entities/payment.entity';
import { PaymentProviderInterface, ProcessPaymentResponse } from '../interfaces/payment-provider.interface';
import { SimulationConfig } from '../payment-provider.factory';

@Injectable()
export class SberbankMockProvider implements PaymentProviderInterface {
  constructor(private readonly config: SimulationConfig) {}

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async processPayment(payment: Payment): Promise<ProcessPaymentResponse> {
    await this.delay(this.config.delayMs);

    const success = Math.random() < this.config.successRate;
    const externalId = `sber_mock_${uuidv4()}`;

    // In a real scenario, this URL would be a redirect to the payment gateway.
    // For the mock, it points to a mock UI endpoint we will create.
    const paymentUrl = success
      ? `/mock/payment/success/${payment.id}`
      : `/mock/payment/failure/${payment.id}`;

    return {
      paymentUrl,
      externalId,
    };
  }

  async getPaymentStatus(externalId: string): Promise<{ status: string; providerResponse: any }> {
    // This would query Sberbank's API in a real implementation.
    // For the mock, we can assume it's still processing or completed based on some logic.
    return Promise.resolve({ status: 'completed', providerResponse: { externalId, mock: true } });
  }

  handleWebhook(data: any): { externalId: string; status: string } {
    // This would parse and validate a real webhook from Sberbank.
    // For the mock, we just extract the data.
    const { externalId, status } = data;
    return { externalId, status };
  }
}
