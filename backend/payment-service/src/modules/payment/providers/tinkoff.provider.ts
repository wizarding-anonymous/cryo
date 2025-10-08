import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Payment } from '../entities/payment.entity';
import {
  PaymentProviderInterface,
  ProcessPaymentResponse,
} from '../interfaces/payment-provider.interface';
import { SimulationConfig } from '../payment-provider.factory';

@Injectable()
export class TinkoffMockProvider implements PaymentProviderInterface {
  private readonly logger = new Logger(TinkoffMockProvider.name);

  constructor(private readonly config: SimulationConfig) {}

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async processPayment(payment: Payment): Promise<ProcessPaymentResponse> {
    this.logger.log(
      `Processing T-Bank payment for order ${payment.orderId}, amount: ${payment.amount} RUB`,
    );

    await this.delay(this.config.delayMs);

    const externalId = `tb_${Date.now()}_${uuidv4().substring(0, 8)}`;

    // Simulate T-Bank payment form URL
    const paymentUrl = `/mock/tbank/payment-form/${payment.id}?externalId=${externalId}`;

    this.logger.log(
      `Generated T-Bank payment URL: ${paymentUrl}, externalId: ${externalId}`,
    );

    return {
      paymentUrl,
      externalId,
    };
  }

  async getPaymentStatus(
    externalId: string,
  ): Promise<{ status: string; providerResponse: any }> {
    this.logger.log(
      `Checking T-Bank payment status for externalId: ${externalId}`,
    );

    await this.delay(400); // Simulate API call delay

    const isSuccess = Math.random() < this.config.successRate;
    const status = isSuccess ? 'completed' : 'failed';

    const providerResponse = {
      externalId,
      status,
      amount: 0, // Would be filled from actual API response
      currency: 'RUB',
      timestamp: new Date().toISOString(),
      provider: 'tbank',
      mock: true,
      tbankPaymentId: `TB${Date.now()}`,
      paymentMethod: 'card', // Could be 'card', 'sbp', 'installment', etc.
    };

    this.logger.log(
      `T-Bank payment status: ${status} for externalId: ${externalId}`,
    );

    return { status, providerResponse };
  }

  handleWebhook(data: any): { externalId: string; status: string } {
    this.logger.log(`Handling T-Bank webhook: ${JSON.stringify(data)}`);

    // Simulate T-Bank webhook format
    const { PaymentId, Status } = data;

    // Map T-Bank statuses to internal statuses
    let status = 'pending';
    switch (Status) {
      case 'CONFIRMED':
        status = 'completed';
        break;
      case 'REJECTED':
      case 'CANCELED':
      case 'REFUNDED':
        status = 'failed';
        break;
      case 'NEW':
      case 'FORM_SHOWED':
      case 'AUTHORIZING':
      case 'AUTHORIZED':
      default:
        status = 'pending';
        break;
    }

    this.logger.log(
      `Mapped T-Bank status ${Status} to ${status} for payment ${PaymentId}`,
    );

    return {
      externalId: PaymentId || data.externalId,
      status,
    };
  }
}
